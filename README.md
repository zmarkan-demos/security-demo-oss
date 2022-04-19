# CI/CD Workshop with CircleCI

## Prerequisites

Knowledge of Git version control system

GitHub account - where the code is hosted

A code editor

## Chapter 1 - Basics of CircleCI

Fork this project!
Most of our work will be in `./circleci/config.yml` - the CircleCI configuration file. This is where we will be describing our CI/CD pipelines.
This workshop is written in chapters, so you can jump between them by running scripts in `srcipts/` dir, if you get lost and want to catch up with something.
To begin, prepare your environment for the initial state by running the start script: `./scripts/chapter_0_start.sh`

Go to app.circleci.com, log in with your GitHub account (or create a new one).
Navigate to the `Projects` tab, and find this workshop project there - `cicd-workshop`.

First we will create a basic continuous integration pipeline, which will run your tests each time you commit some code. Run a commit for each instruction.

- Run: `./scripts/chapter_0_start.sh` to create the environment.
- In the `.circleci/config.yaml` find the `jobs` section, and add a job called `build-and-test`:

```yaml
...
jobs:
  build-and-test:
    docker:
      - image: cimg/node:16.14.0
    steps:
      - checkout
      - run:
          name: Install deps
          command: npm install
      - run:
          name: Run tests
          command: npm run test-ci
```

- Now let's create a workflow that will run our job: 

```yaml
workflows:
  run-tests:
    jobs:
      - build-and-test
```

- Report test results to CircleCI. Add the following run commands to `build-and-test` job:

```yaml
jobs:
  build-and-test:
    ...
      - run:
          name: Run tests
          command: npm run test-ci
      - run:
          name: Copy tests results for storing
          command: |
            cp test-results.xml test-results/
          when: always
      - store_test_results:
          path: test-results
      - store_artifacts:
          path: test-results
```

- 🚨 Error! Fix error by SSHing into the failed job 👩‍💻
- Discover that we missed a `mkdir test-results`:

```yaml
 - run:
          name: Copy tests results for storing
          command: |
            mkdir test-results
            cp test-results.xml test-results/
          when: always

```
- Utilise cache for dependencies to avoid installing each time:

```yaml
jobs:
    build-and-test:
    ...
    steps:
        - checkout
        - restore_cache:
            key: v1-deps-{{ checksum "package-lock.json" }}
        - run:
            name: Install deps
            command: npm install
        - save_cache:
            key: v1-deps-{{ checksum "package-lock.json" }}
            paths: 
                - node_modules   
        - run:
            name: Run tests
            command: npm run test-ci

```

🎉 Congratulations, you've completed the first part of the exercise!

## Chapter 2 - Intermediate CI/CD

In this section you will learn about the CircleCI orbs, and various other types of checks you can implement, as well as deploy your application!

If you got lost in the previous chapter, the initial state of the configuration is in `.circleci/chapters/config_1.yml`. You can restore it by running `./scripts/chapter_1.sh`.

### Use Node orb

- First let's replace our existing process for dependency installation and running tests by using an orb - this saves you a lot of configuration and manages caching for you. Introduce the orb: 

```yaml
version: 2.1

orbs: 
    node: circleci/node@5.0.0
```

- Replace the job caching and dependency installation code with the call to the `node/install_packages` in the Node orb:

```yaml
jobs:
  build-and-test:
    ...
    steps:
        - checkout
        - node/install-packages
        - run:
            name: Run tests
            command: npm run test-ci
```

### Integrate automated dependency vulnerability scan

- Now let's integrate a security scanning tool in our process. We will use Snyk - https://snyk.io for this. You can create a free Snyk account by logging in with your GitHub credentials. Get a Snyk Auth token by going to your Account Settings - https://app.snyk.io/account.

- Add the Auth token to your environment variables - `SNYK_TOKEN`

- Add Snyk orb: 

```yaml
orbs: 
    node: circleci/node@5.0.0
    snyk: snyk/snyk@1.1.2
```

- Add dependency vulnerability scan job:

```yaml
jobs:
...
  dependency-vulnerability-scan:
    docker:
      - image: cimg/node:16.14.0
    steps:
      - checkout
      - node/install-packages
      - snyk/scan:
          fail-on-issues: true
```

- Add the job to workflow:

```yaml
workflows:
  run-tests:
    jobs:
      - build-and-test
      - dependency-vulnerability-scan

```

### Build a Docker image & Deploy it to the registry

Each time the tests pass we will build a Docker image with the web app.

- Create Docker Hub account if you don't already have one - https://docker.com
- Get add Docker Hub account name to environment variables: `DOCKER_LOGIN`, and `DOCKER_PASSWORD`
- Add the Docker orb:

```yaml
orbs: 
  node: circleci/node@5.0.0
  snyk: snyk/snyk@1.1.2
  docker: circleci/docker@2.0.2
```

- Add a job to build a docker image and push it to Docker Hub

```yaml
 jobs:
  ... 
  build-docker:
    docker:
      - image: cimg/base:stable
    steps:
      - checkout
      - setup_remote_docker
      - docker/check
      - docker/build:
          image: $DOCKER_LOGIN/${CIRCLE_PROJECT_REPONAME}-1-March-22
          tag: 0.1.<< pipeline.number >>
      - docker/push:
          image: $DOCKER_LOGIN/${CIRCLE_PROJECT_REPONAME}-1-March-22
          tag: 0.1.<< pipeline.number >>
```

- Add job to workflow:

```yaml
workflows:
  run-tests:
    jobs:
      - build-and-test
      - dependency-vulnerability-scan
      - build-docker
```

- Add `requires` stanza to the job in the workflow, which ensures that verification jobs must complete before building the Docker image.

```yaml
workflows:
  run-tests:
    jobs:
      - build-and-test
      - dependency-vulnerability-scan
      - build-docker:
          requires:
            - build-and-test
            - dependency-vulnerability-scan
```

### Deploy the containerized application to Heroku

Heroku is a service for hosting applications with a free tier & no card required

- Create a Heroku account & grab your API key, store in environment variable: `HEROKU_API_KEY`
- Create a Heroku application - I named mine `hello-circleci-connect-dev`
- Add Heroku orb:

```yaml
orbs: 
  node: circleci/node@5.0.0
  snyk: snyk/snyk@1.1.2
  docker: circleci/docker@2.0.2
  heroku: circleci/heroku@1.2.6
```

- Add deployment job:

```yaml
deploy-to-heroku:
    docker: 
      - image: cimg/base:stable
    steps:
      - heroku/install
      - heroku/check-authentication
      - checkout
      - setup_remote_docker
      - heroku/push-docker-image:
          app-name: hello-circleci-connect-dev
          process-types: web
      - heroku/release-docker-image:
          app-name: hello-circleci-connect-dev
          process-types: web
```

- Add job to workflow after image is built:

```yaml
workflows:
  run-tests:
    jobs:
      - build-and-test
      - dependency-vulnerability-scan
      - build-docker:
          requires:
            - build-and-test
            - dependency-vulnerability-scan
      - deploy-to-heroku:
          requires:
            - build-docker
```

🎉 Contratulations, you have completed the second chapter, and created a full CI/CD pipeline that builds, verifies, and deploys your application!

## Chapter 3 - Advanced CircleCI  

In this section you will learn about advanced features of CircleCI for parallelism, access control, scheduling, dynamic configuration, and more!

If you got lost in the previous chapter, the initial state of the configuration is in `.circleci/chapters/config_2.yml`. You can restore it by running `./scripts/chapter_2.sh`.

### Employing parallelism - running tests in a matrix

We often want to test the same code across different variants of the application. We can employ matrix with CircleCI for that.

- Create a new job parameter for `build-and-test` job, and use its value in the selected image:

```yaml
jobs:
  build-and-test:
    parameters:
      node_version:
        type: string
        default: 16.14.0
    docker:
      - image: cimg/node:<< parameters.node_version >>
    steps:
      - checkout
```

- Pass matrix of versions as parameters for the job in the workflow definition:

```yaml
workflows:
  run-tests:
    jobs:
      - build-and-test:
          matrix:
            parameters:
              node_version: ["16.14.0", "14.19.0", "17.6.0" ]
      - dependency-vulnerability-scan
      ...
```

This sets up the tests to run in a matrix, in parallel. But we must go further. Our tests still run for too long, so we can split them across multiple jobs.

- Change run test command to use CircleCI's test splitting feature:

```yaml
...
jobs:
  build-and-test:
    ...
    steps:
          - checkout
          - node/install-packages
          - run:          
              name: Run tests
              command: |
                echo $(circleci tests glob "test/**/*.test.js")
                circleci tests glob "test/**/*.test.js" | circleci tests split |
                xargs npm run test-ci
          ...
```

- Set job `parallelism` parameter:

```yaml
jobs:
  build-and-test:
    ...
    docker:
      - image: cimg/node:<< parameters.node-version >>
    parallelism: 4
    ...
```

- Make sure test results are merged correctly:

```yaml
jobs:
  build-and-test:
    ...
    steps:
          - checkout
          ...
          - run:
              name: Copy tests results for storing
              command: |
                mkdir ~/test-results
                cp test-results.xml ~/test-results/
              when: always
          - run:
              name: Process test report
              when: always
              command: |
                  # Convert absolute paths to relative to support splitting tests by timing
                  if [ -e ~/test-results.xml ]; then
                    sed -i "s|`pwd`/||g" ~/test-results.xml
                  fi
          - store_test_results:
              path: test-results
          ...
```

### Access and flow control

- Only deploy from `main` branch, using `filters` in the workflow:

```yaml
workflows:
  run-tests:
    jobs:
      ...
      - build-docker:
          requires:
            - build-and-test
            - dependency-vulnerability-scan
          filters:
            branches:
              only: main
      ...
```

Allow jobs fine grained access to credentials by using contexts. 

- In your CircleCI `Organization Settings` tab, create a new context - `workshop_deployment-dev`.
- Add your `HEROKU_API_KEY` environment variable to this context (same as before)
- Specify `context` parameter in the workflow for the `deploy_to_heroku` job:

```yaml
workflows:
  run-tests:
    jobs:
      ...
      - deploy-to-heroku:
          requires:
            - build-docker
          context: workshop_deployment-dev
      ...
```

- You can now delete `HEROKU_API_KEY` in project settings!
- Add approval job before deploying to Heroku:

```yaml
workflows:
  run-tests:
    jobs:
      ...
      - build-docker:
          requires:
            - build-and-test
            - dependency-vulnerability-scan
          filters:
            branches:
              only: main
      - hold-for-approval:
          type: approval
          requires: 
            - build-docker
      - deploy-to-heroku:
          requires:
            - hold-for-approval
          context: workshop_deployment-dev
      ...
```

You can also specify a security group to a context (in an org) to only allow those users to continue.
We can also have multiple deployment environments in different stages, using parameters and contexts.

- Create a new Heroku application - `hello-circleci-connect-prod`
- Add environment parameter to `deploy_to_heroku` job - `environment`:

```yaml
deploy-to-heroku:
    parameters:
      environment:
        type: string
        default: dev
    ...
```

- Use the `environment` parameter in the Heroku deployment steps:

```yaml
  deploy-to-heroku:
    ...
    steps:
      ...
      - heroku/push-docker-image:
          app-name: hello-circleci-connect-<< parameters.environment >>
          process-types: web
      - heroku/release-docker-image:
          app-name: hello-circleci-connect-<< parameters.environment >>
          process-types: web
```

- Add a new `deploy-to-heroku` job, that doesn't filter on branch to the workflow, and pass `dev` parameter to it:

```yaml
workflows:
  run-tests:
    jobs:
      ...
      - dependency-vulnerability-scan
      - deploy-to-heroku:
          context: workshop_deployment-dev
          environment: dev
      ...
```

- Add `prod` parameter to the "original" `deploy-to-heroku` job in the workflow:

```yaml
workflows:
  run-tests:
    jobs:
      ...
      - hold-for-approval:
          type: approval
          requires: 
            - build-docker
      - deploy-to-heroku:
          environment: prod
          requires:
            - hold-for-approval
          context: workshop_deployment-prod
```

### Set up a nightly build to deploy dev version of the application

- In `Project Settings` choose the `Triggers` tab and add a new trigger. Set it to run each day at 0:00 UTC, 1 per hour, off `main` branch. Add pipeline parameter `scheduled` set to `true`.

- Create a new boolean pipeline parameter in the config - `scheduled` which defaults to false:

```yaml
parameters:
  scheduled:
    type: boolean
    default: false
```

- Create a new workflow called `nightly_build` that only runs when `scheduled` is true:

```yaml
workflows:
  ...
  nightly-build:
    when: << pipeline.parameters.scheduled >>
    jobs:
      - build-and-test:
          matrix:
            parameters:
              node_version: ["16.14.0", "14.19.0", "17.6.0" ]
      - dependency-vulnerability-scan
      - deploy-to-heroku:
          context: workshop_deployment-dev
          environment: dev
```

- Add the `when/not` rule to the `run-tests` workflow:

```yaml
workflows:
  run-tests:
    when:
      not: << pipeline.parameters.scheduled >>
    jobs:
      - build-and-test:
      ...
```

### Dynamic config - skip build on scripts change 

Dynamic config lets you change what your pipeline does while it's already running, based on git history, changes, or external factors.

- Toggle dynamic config in project settings - Advanced
- Copy your existing `config.yml` to `continue-config.yml`:

```bash
cp .circleci/config.yml continue-config.yml
```

- Add `setup: true` stanza to your `config.yml`: 

```yaml
version: 2.1

setup: true
...
```

- Add the `path-filtering` orb (and remove others) in `config.yml`

```yaml
orbs: 
  path-filtering: circleci/path-filtering@0.1.1
```

- Remove all jobs and workflows in `config.yml` and replace with the following workflow:

```yaml
workflows:
  choose-config:
    jobs:
      - path-filtering/filter:
          base-revision: main
          config-path: ./circleci/confinue-config.yml
          mapping: |
            scripts/.*  skip-run  true
```

- In `continue-config.yml` add the the `skip-run` pipeline parameter:

```yaml
parameters:
  skip-run:
    type: boolean
    default: false
  scheduled:
    type: boolean
    default: false
```

- Add the `skip-run` parameters to `when not` condition in the `run-tests` workflow:

```yaml
workflows:
  run-tests:
    when:
      and: 
        - not: << pipeline.parameters.scheduled >>
        - not: << pipeline.parameters.skip-run >>
    jobs:
      - build-and-test:
      ...
```

## Assignment!

Exercise - send message to our Discord server from CircleCI to get some CircleCI swag! ✨

Message should include:
  - your email, 
  - link to the CircleCI pipeline or job that sent the message

Discord Webhook URL will be provided at the event. 

It's here: https://discord.com/api/webhooks/947861161733423144/r3LTn7PiVpeVxSc3UPw_BVOim-ek1qZbmMHTgBES2_XLIQBJrz1aigCtmaNKIU4L9A4i  


How you implement it is up to you (there are many ways). Using an orb might be the easiest though... 





