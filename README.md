# Welcome to Windows Workloads on AWS

This project creates a .net web service containerized on ECS behind a Load Balancer.

Requirements: Working Node.js environment, AWS CLI installed with a working profile

1) Ensure you have latest CDK installed `npm install -g aws-cdk`
2) Clone the repository
3) Inside the repo directory, run `npm install`
4) Ensure you have an AWS profile installed and working `aws configure` - make sure Account ID, Secret Key, Region and Output type are set in `~/.aws/credentials`
5) Run `cdk deploy --require-approval never`
6) Once completed, two Cloudformation stacks will be created, one that created an MS SQL Server in RDS, the other that created a Load Balanced ECS Service of type EC2.
The ECS cluster is running the .NET web service: `https://github.com/mptaws/dn-api-server`
Copy the last URL output by the CDK (the loadbalancer URL) and open it in a browser, paste it in a browser and append `/api/todos`.   The result should be a JSON object of 3 todo items.

```
[
    {
        "id": 1,
        "title": "Past Todo 1",
        "completed": false
    },
    {
        "id": 2,
        "title": "Past Todo 2",
        "completed": true
    },
    {
        "id": 3,
        "title": "Future Todo 1",
        "completed": false
    }
]
```

API works as follows:

GET /api/todos - GET all todos
GET /api/todos/{id} - GET a single todo (id is an integer)
POST /api/todos w/ a template body of
```
{
    "title": "Put your todo title here",
    "completed": false
}
```

PUT /api/todo/id - EDIT a specific todo item with template body of
```
{
    "title": "Edit the value here",
    "completed": true
}
```

DELETE /api/todo/{id} - DELETE a specific todo at id

OPTIONAL:
Above API collection available as a Postman Collection in the repository - `TodoApp.postman_collection`
Install postman from `https://www.postman.com/product/api-client/` - be sure to edit the collection variable `url` with the Loadbalancer URL.

