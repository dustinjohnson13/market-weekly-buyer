#!groovy

import groovy.json.JsonOutput

stage('Run') {
    node {
        def build = "${env.JOB_NAME} - #${env.BUILD_NUMBER}".toString()
        def emailAddress = "${env.EMAIL}".toString()
        def email

        currentBuild.result = "SUCCESS"

        try {
            checkout scm

            def dataUsage = sh(script: './gradlew run', returnStdout: true)
            def summary = (dataUsage =~ /Usage:.*%/)[0]
            email = [to: emailAddress, from: emailAddress, subject: "Data Usage - ${summary} - ${new Date().format('yyyy/MM/dd')}", body: "${dataUsage}"]
        } catch (err) {
            currentBuild.result = "FAILURE"

            email = [to: emailAddress, from: emailAddress, subject: "$build failed!", body: "${env.JOB_NAME} failed! See ${env.BUILD_URL} for details."]

            throw err
        } finally {
            emailext body: email.body, recipientProviders: [[$class: 'DevelopersRecipientProvider']], subject: email.subject, to: "${env.EMAIL}"
        }
    }
}
