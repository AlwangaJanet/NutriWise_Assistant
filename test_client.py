import requests
import json

# URL of the running Flask app
API_URL = 'http://127.0.0.1:5000/ask'
HEALTH_URL = 'http://127.0.0.1:5000/health'

print("=== NutriWise AI Test Client ===\n")

# First, check health endpoint
print("1. Checking API health...")
try:
    health_response = requests.get(HEALTH_URL, timeout=10)
    health_data = health_response.json()
    print(f"Health Status: {health_data}")
    
    if not health_data.get('gemini_configured'):
        print("Gemini API not properly configured!")
        exit(1)
        
except requests.exceptions.RequestException as e:
    print(f"Health check failed: {e}")
    exit(1)

print("Health check passed!\n")

# Test the main API
print("2. Testing nutrition question...")

# Sample question to test the API
sample_question = {
    "question": "What should a pregnant woman eat in her second trimester?"
}

print(f"Sending question: {sample_question['question']}")

# Send request
try:
    response = requests.post(
        API_URL, 
        json=sample_question,
        headers={'Content-Type': 'application/json'},
        timeout=30  # Longer timeout for AI response
    )
    
    print(f"Response Status Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")
    
    # Try to get JSON response
    try:
        data = response.json()
        print(f"Response JSON: {data}")
    except json.JSONDecodeError:
        print(f"Response Text (not JSON): {response.text}")
        exit(1)
    
    # Check if request was successful
    if response.status_code == 200:
        if "answer" in data:
            print("\nAI Nutritionist Answer:")
            print("=" * 50)
            print(data["answer"])
            print("=" * 50)
        else:
            print("No answer in response:", data)
    else:
        print(f"API Error (Status {response.status_code}):")
        if "error" in data:
            print(data["error"])
        else:
            print(data)

except requests.exceptions.Timeout:
    print("Request timed out - the AI might be taking too long to respond")
except requests.exceptions.ConnectionError:
    print("Connection failed - is the Flask app running on http://127.0.0.1:5000?")
except requests.exceptions.RequestException as e:
    print(f"Request failed: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")

print("\n=== Test Complete ===")