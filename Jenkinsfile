pipeline {
    agent any

    environment {
        // 우리가 수동으로 ~/S15P11D201 에서 docker compose up 했을 때와
        // 같은 프로젝트로 인식되게 이름을 고정한다 (폴더 이름과 무관하게).
        COMPOSE_PROJECT_NAME = 's15p11d201'
    }

    stages {
        stage('Prepare env') {
            steps {
                withCredentials([file(credentialsId: 'starttoo-env-file', variable: 'ENV_FILE')]) {
                    sh 'cp "$ENV_FILE" .env'
                }
            }
        }

        stage('Build') {
            steps {
                sh 'docker compose build'
            }
        }

        stage('Deploy') {
            steps {
                sh 'docker compose up -d'
            }
        }
    }
}
