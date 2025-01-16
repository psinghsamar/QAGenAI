from locust import HttpUser, task, between

class PerformanceTest(HttpUser):
    wait_time = between(1, 3)
    
    