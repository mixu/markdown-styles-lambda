# markdown-styles-lambda

Automatic static site generation on `git push` using AWS Lambda.

## Features

- automatically rebuilds your markdown files stored on Github repos in response to a git push using AWS Lambda.
- includes a full tutorial on how to set up the rebuild, assuming you are already using S3 for static site hosting
- you can use a single AWS Lambda function to process all of your Github repos; tasks are matched against a repo + branch + filename glob expression and are easily extensible via the API
- features an API inspired by the the Gulp build system: tasks, input streams and stream transformations are used to express the tasks to be done on each repo + branch
- efficient: only downloads files matching a specific glob pattern on a specific branch rather than cloning the whole repo on each rebuild

## Installation

The installation guide is pretty detailed, and sadly involves a lot of clicking around in the AWS UI. Before we get started, here's what we'll have at end:

```
              Github webhook        SNS event triggers
              sends event to SNS    lambda invocation
git push -> [Github] -> [Amazon SNS] -> [Amazon Lambda] -> [S3 bucket]
                  ^                           |      lambda function
                  \-- .md file(s) downloaded -/      regenerates & uploads
                      via the Github API             HTML files to S3
```

Basically, whenever you push to your Github repo, we'll trigger a rebuild of the markdown files on your Github repo on AWS Lambda. The `markdown-styles-lambda`:

- responds to SNS events from Github
- uses the Github API to query for files that match a specific glob
- downloads those specific files via the Github API (more efficient than cloning a full repo every time)
- rebuilds those markdown files using a specific layout and
- uploads the resulting HTML to S3

Once you've set up this pipeline, you can connect it to multiple Github repos! The same `markdown-styles-lambda` can process events from multiple Github repos - you can configure the layouts and target buckets to use for each repo separately.

I am assuming that you are already using S3 for static site hosting. If you haven't set that up, you'll probably want to take a look at this Amazon tutorial first. Now, let's set this up!

### Create an SNS Topic

1. Go to the [Amazon SNS console](https://console.aws.amazon.com/sns).
2. Click **“Create topic”**.
3. Fill in the name and display name fields with whatever you’d like, then click **“Create topic”**.

![](./img/1-sns-topic.png)
![](./img/2-sns-topic-name.png)

Copy the topic ARN for later use.

### Create an IAM User to Publish As

1. Go to [the Amazon IAM console](https://console.aws.amazon.com/iam/home).
2. Click **“Users”** then **“Create New Users”**.
3. Enter a name for the GitHub publisher user. Make sure **“Generate an access key for each user”** is checked.

 ![](./img/3-iam-user.png)

4. Click **“Create”**.
5. Click **“Show User Security Credentials”**, then copy or download the access and secret keys for later use.

  ![](./img/4-iam-user-result.png)

### Add permissions

1. Return to [the main IAM console page](https://console.aws.amazon.com/iam/home).
2. Click **“Users”**, then click the name of your newly created user to edit its properties.
3. Scroll down to **“Permissions”** and ensure that section is open and that the **“Inline Policies”** section is expanded. Click the link (**“click here”**) to create a new inline policy.

 ![](./img/5-inline-policy.png)

4. Select the **“Custom Policy”** radio button, then press **“Select”**.

 ![](./img/6-custom-policy.png)

5. Type a name for your policy, then paste the following statements that authorize publication to the SNS topic you created in Step 1 (here’s where you use the topic ARN you were saving). Then click “Apply Policy”.

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": [
        "sns:Publish"
      ],
      "Resource": [
        <SNS topic ARN goes here>
      ],
      "Effect": "Allow"
    }
  ]
}
```

![](./img/7-apply-policy.png)

### Set up the GitHub Webhook

1. Navigate to your [GitHub](https://github.com/) repo.
2. Click on **“Settings”** in the sidebar.
3. Click on **“Webhooks & Services”**.
4. Click the **“Add service”** dropdown, then click **“AmazonSNS”**.
5. Fill out the form (supplying the IAM user credentials you created in Step 2), then click “Add service”. (Note that the label says “topic”, but it requires the entire ARN, not just the topic name.)

![](./img/8-github-service.png)

### Create GitHub Credentials

1. Go to [Personal access tokens](https://github.com/settings/tokens) in Github settings.
2. Click **“Generate a personal access token”**.
3. Add a token description, leaving everything else as is, then click **“Generate token”**.
4. Copy the token for later use.

![](./img/9-github-credential.png)

### Set up the code

To write your tasks, you should create new folder and `npm install markdown-styles-lambda`.

Next, create a file called `index.js`. You can get started by using the example below:

```js
var lambda = require('markdown-styles-lambda').create();

lambda.config('s3', {
  region: ''
});

lambda.config('github', {
  type: 'oauth',
  token: '',
});

lamdba.task('mixu/singlepageapp#master', function(task) {
  // generate markdown
  return task.github('/input/*.md')
      .pipe(task.generateMarkdown({
        layout: 'github'
      }))
      .pipe(task.s3('s3://bucket/path'));
});

lamdba.task('mixu/singlepageapp#master', function(task) {
  // copy images from /input
  return task.github('/input/**/*.png')
      .pipe(task.s3('s3://bucket/path'));
});

if (lambda.identifyGithubEvent(event.Records[0].Sns.Message) === 'PushEvent') {
  lambda.exec(event.Records[0].Sns.Message, context);
}
```

As you can see in the example above, `markdown-styles-lambda` uses a Gulp-style API, which means it is configured by writing short tasks using code. I considered a JSON-based format, but it would never be as flexible as code.

You start by configuring a set of tasks to be run when events from a specific repository arrive using `lambda.task(repo, fn)`. Next, you define operations to be executed on each repository using the Task API. Tasks have three kinds of functions:

- input stream functions (`task.github(glob)` and `task.fromFs(glob)`): these return readable streams that can be `.pipe()`d into other streams
- transform stream functions (`task.generateMarkdown(opts)`): these modify the objects returned from input streams, then pass the modified objects along and can be `pipe()`d into other streams
- output stream functions (`task.s3(target)`, `task.toFs(path)`): these functions take the `.path` value, and write it to S3 or to the filesystem

Note that because we are streaming the files, they never touch the disk on the machine running Lambda. Instead, every file is represented by an object with a couple of keys (`path`, `contents`, `stat`). See the full API docs below for more information.

You can easily write your own tasks; they just need to be object mode streams that take a single object with the aforementioned keys and that change the keys in some way (convert the content to markdown, change the output path etc.). `pipe-iterators` provides a bunch of shortcuts for writing object mode streams.

### TODO

- copying binary files: need to not clobber http reads. { encoding: null} should return raw buffers and other encoding values should return values with that encoding
- `task.github(glob, basepath)` should work
- task [deps] should work
- wildglob should support an array of globs (!)

### Testing your build

- test runner bin
- how to easily set AWS profile
- how to programmatically set AWS profile

Now, prepare the zip file for Lambda: `make` (if you are on Windows, just manually run `npm install` and then make a zip file from the root of the git repo).


### Create a Lambda Function

1. Open [the AWS Lambda console](https://console.aws.amazon.com/lambda/home).
2. Click on **“Create a Lambda function”**.
3. Click on **"Upload a .ZIP file"**.

 ![](./img/9-create-lambda.png)

4. Set the **Role** to `lambda_s3_exec_role` (this adds the permission for S3)

 ![](./img/10-set-role.png)

5. Set the **Advanced settings**. 192 MB, 30 seconds recommended just in case, but typically I'm seeing about ~44MB used, and ~8 seconds; but this is network I/O and your files may be different).
6. Click **“Create Lambda function”**.
7. On the Lambda function list page, click the **“Actions”** dropdown then pick **“Add event source”**.

 ![](./img/11-add-event-source.png)

8. Select **“SNS”** as the event source type.
9. Choose the SNS topic you created in Step 1, then click **“Submit”**. (Lambda will fill in the ARN for you.)

## Testing your setup

Since there are three systems involved in invoking the lambda, there are three different places where you can trigger an event: the lambda console, the SNS console and the Github webhook UI.

### Testing from the Lambda console


1. In the Lambda console functions list, make sure your GitHub bot function is selected, then choose “Edit/Test” from the Actions dropdown. Choose “SNS” as the sample event type, then click “Invoke” to test your function.

### Testing from the SNS console

2. In the AWS SNS console, open the “Topics” tab, select your GitHub publication topic, then use the “Other topic actions” to select “Delivery status”. Complete the wizard to set up CloudWatch Logs delivery confirmations, then press the “Publish to topic” button to send a test message to your topic (and from there to your Lambda function). You can then go to the CloudWatch Log console to view a confirmation of the delivery and (if everything is working correctly) also see it reflected in the CloudWatch events for your Lambda function and you Lambda function’s logs as well.

### Testing from Github

1. In the “Webhooks & Services” panel in your GitHub repository, click the “Test service” button.
2. Open the AWS Lambda console.
3. In the function list, under “CloudWatch metrics at a glance” for your function, click on any one of the “logs” links.
4. Click on the timestamp column header to sort the log streams by time of last entry.
5. Open the most recent log stream.
6. Verify that the event was received from GitHub.

# API

### API - lambda

- `lambda.create()`: easier-to-type equivalent to `new (require('markdown-styles-lambda'))()`. Start your app by running `lambda = require('markdown-styles-lambda').create();`

#### lambda.config(key, hash)

Sets configuration for a specific key. The supported keys are:

- `s3`: the set of parameters passed to [`new AWS.S3()`](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property).  You'll want to set the region property to match the region of your S3 bucket; the credentials are already set correctly when running a Lambda.
- `github`: the set of parameters passed to [`github.authenticate()`](http://mikedeboer.github.io/node-github/#Client.prototype.authenticate). Set the token to the oAuth token you obtained earlier.

Can also be called:

- `lambda.config(hash)`: sets the configuration hash; the hash should have keys like `s3: {}` and `github: {}`
- `lambda.config()`: returns the configuration hash

#### lambda.task(repo, [deps], fn)

Define a new task to be run against `repo`.

- `repo` should be a string like `user/repo#branch-or-sha`)
- `fn` can be:
  - a synchronous function like `function(task) { ... }`
    - that returns a stream `function(task) { return stream })`
    - that returns a promise `function(task) { return promise })`
  - an asynchronous function that takes a `onDone` callback (e.g. `function(err)`) like `function(task, onDone) { onDone(err); }`

#### lambda.exec(event, onDone)

Given a specific event, executes all tasks that match the event

- `event` can be a Github or a Github repo name like `user/repo#branch`. The event repo name, username and branch are parsed with [identify-github-event](https://github.com/mixu/identify-github-event) which should be able to handle any github event that has the necessary fields.
- `onDone` can be a AWS context object or a function `function(err) { ... }` that is called on completion

#### lambda.identifyGithubEvent(event)

Returns the canonical, CamelCased name of a Github event given a JSON hash that is a Github event.

### API - Task

#### task properties

`task.user`
`task.repo`
`task.branch`

#### task.github(glob)

Emits downloaded Github files matching the provided glob on the current repository. Returns a readable stream of file objects that can be [piped](https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options) to plugins.

The file objects have the following keys:

- `path`
  - for github, an absolute path starting from the base of the github repo
  - for fromfs, an absolute path (after removing the base of the glob)
- `stat` (the fs.stat object associated with the input file),
- `contents` (a string with the content of the input file).


Note that the file paths are always "abstract" in that they are relative to the root of the repository rather than paths to real files on disk.

Note that paths are relative to the glob expression; everything before a glob starts is stripped out.

You can safely start multiple `task.github()` calls at the same time against the same repo. They all share the same caching system, so concurrent tasks that fetch the same API endpoint will share the same response (rather than making extra calls against the API).

To limit the number of directory traversal API calls needed, make sure you use a fairly specific glob expression. For example `input/*.md` is better than `**/*.md` because it only requires reading the `input/` directory's contents whereas `**/*.md` will require loading traversing all folders within the Github repository.

- `task.github(glob, basepath)`: TODO

for example to copy all files matching these globs, ...

#### task.fromFs(glob)

Emits files matching provided glob or an array of globs from the file system.

- `task.fromFs(glob, basepath)`



#### task.generateMarkdown(opts)

Converts `contents` from markdown to HTML; changes the extension of the file to .html.

Accepts the following options:

- `layout`: a name of a builtin layout or a path relative to the root of the repo to use for the `markdown-styles` tasks
- `asset-path`: the path to the assets folder, relative to the output URL
- `meta`: a JSON hash that has the contents of the `meta.json` file to merge in
- `layout`: name of a builtin layout or an absolute path to a layout
- `highlight-extension`: a string that specifies the name of a highlighter module or an absolute path to a highlighter module for `extension`, e.g. `--highlight-csv /foo/highlight-csv`.


If you want to user your own layout, just point the `layout` to a path relative to the root of the repo.

for example, to build all files in `input/*.md` and to write them using their paths relative to the github repo's root to `s3://bucket/path`

##### Using an alternative asset path

- set `asset-path` to the asset folder location relative to the root of the output domain

##### Copying the contents of an asset folder

Example where you copy all of the assets from Github to S3.

#### task.s3(target)

Returns a writable stream that can be piped to and it will write files to S3.

##### Renaming files

Rule #1: always rename files before converting them to markdown so that any asset paths are resolved correctly.

Rule #2: all paths are relative to the root of the repository.

If you want to change the path of the files, you can change the `path` property on the file objects.

```js
lambda.task('mixu/nwm', function(task) {
  return task.github('/*.md')
      .pipe(pi.map(function(file) {
        // from /*.md -> /nwm/*.md
        file.path = '/' + task.repo + file.path;
        return file;
      }))
      .pipe(task.generateMarkdown({
        layout: __dirname + '/layouts/readme',
        // E.g. assets are located in __dirname/output/assets/
        'asset-path': '/assets',
      }))
      // prepends __dirname/output/ to every incoming path
      // e.g. output goes to __dirname/output/nwm/*.html
      .pipe(task.toFs(__dirname + '/output/'));
});
```


There are four different cases:

- base to base
  - `/` git path
  - `/assets` asset path
  - `http://example.com/` output URL
- base to subdir
  - `/` git path
  - replace `/` with `/sub` after `task.github()`
  - `/assets` asset path
  - `http://example.com/sub` output URL
- subdir to base
  - `/sub` git path
  - replace `/sub` with `/` after `task.github`
  - `/assets` asset path
  - `http://example.com/` output URL
- subdir to subdir
  - `/sub` git path
  - replace `/sub` with `/other` after `task.github`
  - `/assets` asset path
  - `http://example.com/other` output URL


#### task.toFs(prepend)

Returns a writable stream that can be piped to and it will write files to the file system.


Note that assets are not automatically uploaded. Run `make upload-assets` to upload the assets.

## Automate maybe???

```
$ aws lambda create-function \
--region us-west-2 \
--function-name CreateThumbnail \
--zip-file fileb://file-path/CreateThumbnail.zip \
--role role-arn \
--handler CreateThumbnail.handler \
--runtime nodejs \
--profile adminuser \
--timeout 10 \
--memory-size 1024

$ aws lambda update-function-configuration \
   --function-name CreateThumbnail  \
   --region us-west-2 \
   --timeout timeout-in-seconds \
   --profile adminuser
```

