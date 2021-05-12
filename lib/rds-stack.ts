import { App, StackProps, Stack, Duration, RemovalPolicy, CfnOutput } from "@aws-cdk/core";
import {
    DatabaseSecret, Credentials, ParameterGroup, SqlServerEngineVersion, DatabaseInstance, DatabaseInstanceEngine, OptionGroup, StorageType
} from '@aws-cdk/aws-rds';
import { Vpc, Port, SubnetType, Instance, InstanceType, InstanceClass, InstanceSize, SecurityGroup, Peer } from '@aws-cdk/aws-ec2';
import { Secret } from '@aws-cdk/aws-secretsmanager';

export class RDSStack extends Stack {
    readonly vpc: Vpc;

    readonly dbSecret: DatabaseSecret;
    readonly sqlServerInstance: DatabaseInstance;
    readonly secgroup: SecurityGroup;

    constructor(scope: App, id: string, props: StackProps) {
        super(scope, id, props);

        const dbUser = this.node.tryGetContext("dbUser");
        const dbName = this.node.tryGetContext("dbName");
        const dbPort = this.node.tryGetContext("dbPort") || 1433;

        this.vpc = new Vpc(this, 'ecsWorkshopVPC', {
            cidr: "10.0.0.0/16",
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: 'public',
                    subnetType: SubnetType.PUBLIC,
                },
                {
                    cidrMask: 24,
                    name: 'private',
                    subnetType: SubnetType.PRIVATE,
                },
            ],
        });

        this.dbSecret = new Secret(this, 'dbSecret', {
            secretName: "ecsworkshop/test/todo-app/sql-server",
            generateSecretString: {
                secretStringTemplate: JSON.stringify({
                    username: dbUser,
                }),
                excludePunctuation: true,
                includeSpace: false,
                generateStringKey: 'password'
            }
        });

        this.secgroup = new SecurityGroup(this, "apiSQLsg", {
            vpc: this.vpc,
            securityGroupName: "api-sqlsvr-sg",
            allowAllOutbound: false
        });

        this.secgroup.addIngressRule(Peer.anyIpv4(), Port.tcp(1433));

        this.sqlServerInstance = new DatabaseInstance(this, "MSSQLServer", {
            vpc: this.vpc,
            instanceIdentifier: "api-mssqlserver",
            engine: DatabaseInstanceEngine.sqlServerEx({ version: SqlServerEngineVersion.VER_14 }),
            credentials: Credentials.fromSecret(this.dbSecret, dbUser),
            instanceType: InstanceType.of(InstanceClass.BURSTABLE3, InstanceSize.SMALL),
            allocatedStorage: 100,
            storageType: StorageType.GP2,
            multiAz: false,
            vpcSubnets: { subnetType: SubnetType.PUBLIC },
            deletionProtection: false,
            backupRetention: Duration.days(0),
            removalPolicy: RemovalPolicy.DESTROY,
            parameterGroup: ParameterGroup.fromParameterGroupName(this, 'ParameterGroup', 'default.sqlserver-ex-14.0'),
            optionGroup: OptionGroup.fromOptionGroupName(this, 'OptionGroup', 'default:sqlserver-ex-14-00'),
            securityGroups: [this.secgroup],
            enablePerformanceInsights: false,
            autoMinorVersionUpgrade: false
        });

        this.sqlServerInstance.connections.allowFromAnyIpv4(Port.tcp(dbPort));

        //this.connStr = `Server=${this.sqlServerInstance.dbInstanceEndpointAddress}; Database=${dbName}; User ID=${dbUser}; Password=${this.dbSecret.secretValueFromJson('password')};`;

        new CfnOutput(this, 'SecretName', { value: this.dbSecret.secretName });
        new CfnOutput(this, 'DBEndpoint', { value: this.sqlServerInstance.dbInstanceEndpointAddress });
    }
}