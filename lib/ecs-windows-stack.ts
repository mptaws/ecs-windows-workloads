import * as cdk from '@aws-cdk/core';
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import { Secret as ECSSecret } from "@aws-cdk/aws-ecs";
import { ApplicationLoadBalancedEc2Service } from '@aws-cdk/aws-ecs-patterns';
import * as logs from "@aws-cdk/aws-logs";
import { Secret } from '@aws-cdk/aws-secretsmanager';
import * as iam from '@aws-cdk/aws-iam';

export interface ECSWindowsStackProps extends cdk.StackProps {
  vpc: ec2.Vpc
  dbSecretArn: string
}

export class ECSWindowsStack extends cdk.Stack {

  constructor(scope: cdk.App, id: string, props: ECSWindowsStackProps) {

    super(scope, id, props);

    const containerPort = this.node.tryGetContext("containerPort");
    const containerImage = this.node.tryGetContext("containerImage");
    const creds = Secret.fromSecretCompleteArn(this, 'mssqlcreds', props.dbSecretArn);

    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: "ecs-windows-demo",
      vpc: props.vpc
    });

    const asg = cluster.addCapacity('WinEcsNodeGroup', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.LARGE),
      machineImage: ecs.EcsOptimizedImage.windows(ecs.WindowsOptimizedVersion.SERVER_2019),
      minCapacity: 1,
      maxCapacity: 3,
      canContainersAccessInstanceRole: false,
    });

    const security_group = new ec2.SecurityGroup(this, "winEcs-security-group", {
      vpc: cluster.vpc
    });

    const taskRole = new iam.Role(this, "EcsTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com")
    });

    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        "secretsmanager:GetSecretValue",
        "kms:Decrypt"
      ],
      resources: [
        `arn:aws:secretsmanager:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:secret/*`,
        `arn:aws:kms:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:key/*`,
      ],
      effect: iam.Effect.ALLOW
    }))

    security_group.addIngressRule(ec2.Peer.ipv4("0.0.0.0/0"), ec2.Port.tcp(5000));
    security_group.addIngressRule(ec2.Peer.ipv4("0.0.0.0/0"), ec2.Port.tcp(80));

    asg.addSecurityGroup(security_group);

    const user_data = ec2.UserData.forWindows()
    user_data.addCommands(
      '[Environment]::SetEnvironmentVariable("ECS_ENABLE_AWSLOGS_EXECUTIONROLE_OVERRIDE", $TRUE, "Machine")',
      `Initialize-ECSAgent -Cluster ${cluster.clusterName} -EnableTaskIAMRole -LoggingDrivers '["json-file","awslogs"]'`
    )

    const task = new ecs.TaskDefinition(this, "apiTask", {
      compatibility: ecs.Compatibility.EC2,
      cpu: "1024",
      memoryMiB: "2048",
      networkMode: ecs.NetworkMode.NAT,
      taskRole: taskRole
    });

    const logGroup = new logs.LogGroup(this, "TodoAPILogging", {
      retention: logs.RetentionDays.ONE_WEEK,
    })

    const container = task.addContainer("TodoAPI", {
      image: ecs.ContainerImage.fromRegistry(containerImage),
      memoryLimitMiB: 2048,
      cpu: 1024,
      essential: true,
      logging: ecs.LogDrivers.awsLogs({
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
      interval: cdk.Duration.seconds(60),
      timeout: cdk.Duration.seconds(15)
    });



    new cdk.CfnOutput(this, "ALBEndpoint", {
      value: ecsEc2Service.loadBalancer.loadBalancerDnsName
    });
  }
}

