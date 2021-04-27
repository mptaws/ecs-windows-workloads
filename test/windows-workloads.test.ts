import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as WindowsWorkloads from '../lib/windows-workloads-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new WindowsWorkloads.WindowsWorkloadsStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
