pipeline {
    agent any

    options {
        // Deploy 가 스택 전체를 down 하고 다시 up 하므로 두 빌드가 겹치면 반드시 깨진다.
        // 실제로 빌드 92·93 이 동시에 돌면서 서로의 컨테이너를 지우고 이름 충돌로 둘 다
        // 실패했고, nginx 가 뜨지 못해 서비스가 중단됐다. 두 번째 빌드는 큐에서 기다린다.
        // abortPrevious 는 쓰지 않는다. down 과 up 사이에서 끊기면 스택이 반쯤 내려간
        // 상태로 남아 같은 사고가 난다.
        disableConcurrentBuilds()
    }

    environment {
        // 우리가 수동으로 ~/S15P11D201 에서 docker compose up 했을 때와
        // 같은 프로젝트로 인식되게 이름을 고정한다 (폴더 이름과 무관하게).
        COMPOSE_PROJECT_NAME = 's15p11d201'
    }

    stages {
        stage('Build') {
            steps {
                withCredentials([file(credentialsId: 'starttoo-env-file', variable: 'ENV_FILE')]) {
                    sh 'docker compose --env-file "$ENV_FILE" build'
                }
            }
        }

        stage('Deploy') {
            steps {
                withCredentials([file(credentialsId: 'starttoo-env-file', variable: 'ENV_FILE')]) {
                    sh '''
                        docker compose --env-file "$ENV_FILE" down --remove-orphans
                        COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file "$ENV_FILE" up -d --remove-orphans
                    '''
                }
            }
        }
    }
}
