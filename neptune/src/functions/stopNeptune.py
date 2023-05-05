import boto3
import os
import sys
import time
from datetime import datetime, timezone
from time import gmtime, strftime

def shut_rds_all():
    region=os.environ['REGION']
    key=os.environ['KEY']
    value=os.environ['VALUE']

    
    client = boto3.client('neptune', region_name=region)
    response=client.describe_db_clusters()
    for i in response['DBClusters']:
        print(i)
        cluarn=i['DBClusterArn']
        resp2=client.list_tags_for_resource(ResourceName=cluarn)
        print(cluarn)
        print(resp2)
        if 0==len(resp2['TagList']):
            print('DB Cluster {0} is not part of autoshutdown'.format(i['DBClusterIdentifier']))
        else:
            for tag in resp2['TagList']:
                if tag['Key']==key and tag['Value']==value:
                    if i['Status'] == 'available':
                        client.stop_db_cluster(DBClusterIdentifier=i['DBClusterIdentifier'])
                        print('stopping DB cluster {0}'.format(i['DBClusterIdentifier']))
                    elif i['Status'] == 'stopped':
                        print('DB Cluster {0} is already stopped'.format(i['DBClusterIdentifier']))
                    elif i['Status']=='starting':
                        print('DB Cluster {0} is in starting state. Please stop the cluster after starting is complete'.format(i['DBClusterIdentifier']))
                    elif i['Status']=='stopping':
                        print('DB Cluster {0} is already in stopping state.'.format(i['DBClusterIdentifier']))
                elif tag['Key'] != key and tag['Value'] != value:
                    print('DB Cluster {0} is not part of autoshutdown'.format(i['DBClusterIdentifier']))
                else:
                    print('DB Instance {0} is not part of auroShutdown'.format(i['DBClusterIdentifier']))

def lambda_handler(event, context):
    shut_rds_all()