pipeline {
    agent any

    stages {
        stage('Hello') {
            steps {
                echo 'Jenkins pipeline connection test'
                sh 'whoami'
                sh 'docker --version'
            }
        }
    }
}
