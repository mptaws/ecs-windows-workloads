import * as cdk from '@aws-cdk/core';
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import { ApplicationLoadBalancedEc2Service } from '@aws-cdk/aws-ecs-patterns';
import * as logs from "@aws-cdk/aws-logs";

export class ECSWindowsStack extends cdk.Stack {

  constructor(scope: cdk.App, id: string, props: cdk.StackProps) {

    super(scope, id, props);

    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: "ecs-windows-demo"
    });

    const asg = cluster.addCapacity('WinEcsNodeGroup', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.LARGE),
      machineImage: ecs.EcsOptimizedImage.windows(ecs.WindowsOptimizedVersion.SERVER_2019),
      minCapacity: 1,
      desiredCapacity: 3,
      maxCapacity: 3,
      canContainersAccessInstanceRole: false
    });

    const security_group = new ec2.SecurityGroup(this, "winEcs-security-group", {
      vpc: cluster.vpc
    });

    security_group.addIngressRule(ec2.Peer.ipv4("0.0.0.0/0"), ec2.Port.tcp(5000));
    security_group.addIngressRule(ec2.Peer.ipv4("0.0.0.0/0"), ec2.Port.tcp(80));

    asg.addSecurityGroup(security_group);

    const task = new ecs.TaskDefinition(this, "apiTask", {
      compatibility: ecs.Compatibility.EC2,
      cpu: "1024",
      memoryMiB: "2048",
      networkMode: ecs.NetworkMode.NAT
    });

    const logGroup = new logs.LogGroup(this, "TodoAPILogging", {
      retention: logs.RetentionDays.ONE_WEEK,
    })

    const logGroupName = logGroup.logGroupName;

    const container = task.addContainer("TodoAPI", {
      image: ecs.ContainerImage.fromRegistry("mptaws/dnapiserver"),
      memoryLimitMiB: 2048,
      cpu: 1024,
      entryPoint: ["dotnet", "api.dll"],
      essential: true,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "TodoAPI",
        logGroup: logGroup,
      })
    });

    container.addPortMappings({
      containerPort: 5000
    });

    const ecsEc2Service = new ApplicationLoadBalancedEc2Service(this, 'demoapp-service-demo', {
      cluster,
      cpu: 1024,
      desiredCount: 3,
      minHealthyPercent: 50,
      maxHealthyPercent: 300,
      serviceName: 'winapp-service-demo',
      taskDefinition: task,
      publicLoadBalancer: true
    });

    new cdk.CfnOutput(this, "ALBEndpoint", {
      value: ecsEc2Service.loadBalancer.loadBalancerDnsName
    });
  }
}

