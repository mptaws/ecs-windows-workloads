import * as cdk from '@aws-cdk/core';
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import { ApplicationLoadBalancedEc2Service } from '@aws-cdk/aws-ecs-patterns';

export class ECSWindowsStack extends cdk.Stack {

  constructor(scope: cdk.App, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: "ecs-windows"
    });

    const asg = cluster.addCapacity('WindowsEcsNodeGroup', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.LARGE),
      machineImage: ecs.EcsOptimizedImage.windows(ecs.WindowsOptimizedVersion.SERVER_2019),
      minCapacity: 1,
      desiredCapacity: 1,
      maxCapacity: 6,
      canContainersAccessInstanceRole: false
    });

    const security_group = new ec2.SecurityGroup(this, "win-ecs-security-group", {
      vpc: cluster.vpc
    });

    security_group.addIngressRule(ec2.Peer.ipv4("0.0.0.0/0"), ec2.Port.tcp(5002));

    asg.addSecurityGroup(security_group);

    const task = new ecs.TaskDefinition(this, "apiTask", {
      compatibility: ecs.Compatibility.EC2,
      cpu: "1024",
      memoryMiB: "2048",
      networkMode: ecs.NetworkMode.NAT
    });

    const container = task.addContainer("WebAPI", {
      //image: ecs.ContainerImage.fromRegistry("mptaws/dn-api-server:latest"),
      image: ecs.ContainerImage.fromRegistry("microsoft/iis"),
      memoryLimitMiB: 2048,
      cpu: 1024,
      entryPoint: ["powershell", "-Command"],
      command: ["New-Item -Path C:\\inetpub\\wwwroot\\index.html -ItemType file -Value '<html> <head> <title>Amazon ECS Sample App</title> <style>body {margin-top: 40px; background-color: #333;} </style> </head><body> <div style=color:white;text-align:center> <h1>Amazon ECS Sample App</h1> <h2>Congratulations!</h2> <p>Your application is now running on a container in Amazon ECS.</p>' -Force ; C:\\ServiceMonitor.exe w3svc"],
      essential: true
    });

    container.addPortMappings({
      containerPort: 80,
      hostPort: 8080,
      protocol: ecs.Protocol.TCP
    });


    const ecsEc2Service = new ApplicationLoadBalancedEc2Service(this, 'demoapp-service', {
      cluster,
      cpu: 1024,
      desiredCount: 1,
      minHealthyPercent: 50,
      maxHealthyPercent: 300,
      serviceName: 'winapp-service',
      taskDefinition: task,
      publicLoadBalancer: true
    });

    new cdk.CfnOutput(this, "ALBEndpoint", {
      value: ecsEc2Service.loadBalancer.loadBalancerDnsName
    });
  }
}

