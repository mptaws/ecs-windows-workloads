#!/usr/bin/env node
import { App } from '@aws-cdk/core';
import { ECSWindowsStack } from '../lib/ecs-windows-stack';
import { RDSStack } from '../lib/rds-stack';
import { VPCStack } from '../lib/vpc-stack';

const app = new App();

const vpcStack = new VPCStack(app, 'VPCStack', {
    maxAzs: 2
});

const rdsStack = new RDSStack(app, 'RDSStack', {
    vpc: vpcStack.vpc
});

const ecsStack = new ECSWindowsStack(app, "ECSWindowsStack", {
    vpc: vpcStack.vpc,
    dbSecretArn: rdsStack.dbSecret.secretArn
});

ecsStack.addDependency(rdsStack);
rdsStack.addDependency(vpcStack);
