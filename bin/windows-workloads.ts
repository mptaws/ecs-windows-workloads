#!/usr/bin/env node
import { App } from '@aws-cdk/core';
import { ECSWindowsStack } from '../lib/ecs-windows-stack';
import { RDSStack } from '../lib/rds-stack';

const app = new App();

const rdsStack = new RDSStack(app, 'RDSStack', {});

const ecsStack = new ECSWindowsStack(app, "ECSWindowsStack", {
    vpc: rdsStack.vpc,
    connStr: rdsStack.connStr
});

ecsStack.addDependency(rdsStack);
