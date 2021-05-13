import { App, Stack, StackProps, Duration } from '@aws-cdk/core';
import { Vpc, Peer, Port, SecurityGroup, InstanceType, InstanceClass, InstanceSize } from "@aws-cdk/aws-ec2";
import {
  Cluster, EcsOptimizedImage, WindowsOptimizedVersion, TaskDefinition,
  Compatibility, NetworkMode, ContainerImage, LogDrivers, Secret as ECSSecret
} from "@aws-cdk/aws-ecs";
import { ApplicationLoadBalancedEc2Service } from '@aws-cdk/aws-ecs-patterns';
import { LogGroup, RetentionDays } from "@aws-cdk/aws-logs";
import { Secret } from '@aws-cdk/aws-secretsmanager';
import { Role, ServicePrincipal, Effect, PolicyStatement } from '@aws-cdk/aws-iam';

export interface ECSWindowsStackProps extends StackProps {
  vpc: Vpc
  dbSecretArn: string
}

export class ECSWindowsStack extends Stack {

  constructor(scope: App, id: string, props: ECSWindowsStackProps) {

    super(scope, id, props);

    const containerPort = this.node.tryGetContext("containerPort");
    const containerImage = this.node.tryGetContext("containerImage");
    const creds = Secret.fromSecretCompleteArn(this, 'mssqlcreds', props.dbSecretArn);

    const cluster = new Cluster(this, 'Cluster', {
      clusterName: "ecs-windows-demo",
      vpc: props.vpc
    });

    const asg = cluster.addCapacity('WinEcsNodeGroup', {
      instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.LARGE),
      machineImage: EcsOptimizedImage.windows(WindowsOptimizedVersion.SERVER_2019),
      minCapacity: 1,
      maxCapacity: 3,
      canContainersAccessInstanceRole: false,
    });

    const taskSecGroup = new SecurityGroup(this, "winEcs-security-group", {
      vpc: props.vpc
    });

    const taskRole = new Role(this, "EcsTaskRole", {
      assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com")
    });

    taskRole.addToPolicy(new PolicyStatement({
      actions: [
        "secretsmanager:GetSecretValue",
        "kms:Decrypt"
      ],
      resources: [
        `arn:aws:secretsmanager:${Stack.of(this).region}:${Stack.of(this).account}:secret/*`,
        `arn:aws:kms:${Stack.of(this).region}:${Stack.of(this).account}:key/*`,
      ],
      effect: Effect.ALLOW
    }))

    taskSecGroup.addIngressRule(Peer.ipv4("0.0.0.0/0"), Port.tcp(5000));
    taskSecGroup.addIngressRule(Peer.ipv4("0.0.0.0/0"), Port.tcp(80));

    asg.addSecurityGroup(taskSecGroup);

    const userData = [
      '[Environment]::SetEnvironmentVariable("ECS_ENABLE_AWSLOGS_EXECUTIONROLE_OVERRIDE", $TRUE, "Machine")',
      `Initialize-ECSAgent -Cluster ${cluster.clusterName} -EnableTaskIAMRole -LoggingDrivers '["json-file","awslogs"]'`
    ];

    asg.addUserData(...userData);

    const task = new TaskDefinition(this, "apiTask", {
      compatibility: Compatibility.EC2,
      cpu: "1024",
      memoryMiB: "2048",
      networkMode: NetworkMode.NAT,
      taskRole: taskRole
    });

    const logGroup = new LogGroup(this, "TodoAPILogging", {
      retention: RetentionDays.ONE_DAY,
    })

    const container = task.addContainer("TodoAPI", {
      image: ContainerImage.fromRegistry(containerImage),
      memoryLimitMiB: 2048,
      cpu: 1024,
      essential: true,
      logging: LogDrivers.awsLogs({
        streamPrefix: "TodoAPI",
        logGroup: logGroup,
      }),
      secrets: {
        DBHOST: ECSSecret.fromSecretsManager(creds!, 'host'),
        DBUSER: ECSSecret.fromSecretsManager(creds!, 'username'),
        DBPASS: ECSSecret.fromSecretsManager(creds!, 'password')
      }
    });

    container.addPortMappings({
      containerPort: containerPort
    });

    const ecsEc2Service = new ApplicationLoadBalancedEc2Service(this, 'demoapp-service-demo', {
      cluster,
      cpu: 1024,
      desiredCount: 2,
      minHealthyPercent: 50,
      maxHealthyPercent: 300,
      serviceName: 'winapp-service-demo',
      taskDefinition: task,
      publicLoadBalancer: true,
    });

    ecsEc2Service.targetGroup.configureHealthCheck({
      path: "/health",
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 5,
      interval: Duration.seconds(60),
      timeout: Duration.seconds(15)
    });

  }
}

