#!/usr/bin/env node
import { App } from '@aws-cdk/core';
import { ECSWindowsStack } from '../lib/ecs-windows-stack';

const app = new App();

new ECSWindowsStack(app, "ECSWindowsStack", {});
