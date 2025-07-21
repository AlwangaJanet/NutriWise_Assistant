# Necessary imports
import os
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import traceback

# Load environment variables
load_dotenv()

# Check if the API key is loading
api_key = os.getenv("GEMINI_API_KEY")
print("Loaded GEMINI_API_KEY:", api_key[:10] + "..." if api_key else "None")

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Test Gemini API connection on startup
try:
    genai.configure(api_key=api_key)
    print("Gemini API configured successfully")
    
    # List available models first
    print("Available models:")
    available_models = []
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"  - {m.name}")
            available_models.append(m.name)
    
    # Try different model names in order of preference
    model_names_to_try = [
        'gemini-1.5-flash',
        'gemini-1.5-pro', 
        'gemini-1.0-pro',
        'models/gemini-1.5-flash',
        'models/gemini-1.5-pro',
        'models/gemini-1.0-pro'
    ]
    
    model = None
    for model_name in model_names_to_try:
        try:
            print(f"Trying model: {model_name}")
            test_model = genai.GenerativeModel(model_name=model_name)
            test_response = test_model.generate_content("Hello")
            model = test_model
            print(f"Successfully using model: {model_name}")
            break
        except Exception as model_error:
            print(f"Model {model_name} failed: {str(model_error)}")
            continue
    
    if model is None:
        print("No working model found!")
        if available_models:
            print(f"Available models were: {available_models}")
    
except Exception as e:
    print(f"Gemini API setup failed: {str(e)}")
    model = None

@app.route('/ask', methods=['POST'])
def ask_questions():
    try:
        # Check if model is available
        if model is None:
            return jsonify({'error': 'Gemini API not properly configured'}), 500
        
        # Get and validate request data
        if not request.is_json:
            return jsonify({'error': 'Request must be JSON'}), 400
        
        data = request.get_json()
        print(f"Received data: {data}")  # Debug log
        
        if not data:
            return jsonify({'error': 'No JSON data received'}), 400
        
        user_question = data.get('question', '')
        print(f"Extracted question: '{user_question}'")  # Debug log
        
        if not user_question.strip():
            return jsonify({'error': 'Question field is required and cannot be empty'}), 400

        prompt = f"""
You are NutriWise, a certified Kenyan AI nutritionist. Your job is to provide affordable, culturally relevant, and evidence-based nutrition advice to Kenyans. Respond clearly, in a friendly and professional tone.

Use these examples to guide your tone, language, and type of advice:

Q: What are healthy snacks for school-going children?
A: Some affordable options include fruits like bananas, mangoes, and apples, boiled eggs, groundnuts, homemade popcorn, or plain yoghurt. These offer energy and essential nutrients for growing children.

Q: How often should I take traditional vegetables?
A: It is recommended to eat traditional vegetables like kunde, managu, mrenda, or terere at least 3 to 4 times per week. They are rich in iron, fiber, and vitamins, which support blood health and digestion.

Q: What is a good diet for someone with high blood pressure?
A: Eat foods low in salt and fat. Focus on fresh vegetables, fruits, beans, and whole grains. Limit red meat, processed snacks, and sugary drinks. Drink plenty of water and reduce stress.

Q: What should I eat to gain weight in a healthy way?
A: Include high-calorie nutritious foods like peanut butter, avocados, boiled eggs, whole milk, maize and beans (githeri), and rice with vegetables. Eat more frequently and include snacks between meals.

Q: I have ulcers. What should I avoid?
A: Avoid spicy foods, acidic fruits (like citrus), too much tea/coffee, alcohol, and fried foods. Instead, eat soft, bland meals like uji, bananas, rice, and vegetables. Eat small portions frequently.

Q: What should a pregnant woman eat in her 2nd trimester?
A: She should eat iron-rich foods like liver, spinach (mchicha), beans, and fortified cereals. Include calcium-rich foods like milk, sardines, and green leafy vegetables. Also, take enough water and prenatal vitamins as prescribed.

Q: What food can help a child gain weight?
A: Give them energy-dense foods like mashed bananas with peanut butter, uji with milk, rice with beans and avocado, and boiled eggs. Offer frequent small meals and healthy snacks.

Q: What foods should a diabetic avoid?
A: Avoid sugary drinks, processed snacks, white bread, and fatty fried foods. Instead, choose whole grains, vegetables, legumes, and fruits in moderation like apples and pawpaws.

Q: How can I eat healthy on 300 shillings a week?
A: Buy affordable staples like maize flour, beans, green grams, sukuma wiki, carrots, and bananas. Cook in bulk to reduce costs, and avoid junk food. Uji, githeri, and vegetable stews are both nutritious and affordable.

Q: I have anemia. What should I eat?
A: Eat iron-rich foods like liver, spinach, managu, and beans. Combine them with vitamin C sources like oranges or tomatoes to boost absorption. Avoid tea right after meals, as it blocks iron uptake.

Q: What is a good meal plan for a breastfeeding mother?
A: Eat a variety of foods: ugali, greens, beans, fish, milk, porridge, fruits, and plenty of water. Breastfeeding mothers need extra calories and hydration to support milk production.

Q: What are signs of malnutrition in children?
A: Common signs include stunted growth, weight loss, swollen belly, frequent illness, pale skin, and irritability. Seek advice from a health clinic or nutritionist for support.

Now answer this question for a Kenyan audience:

Q: {user_question}
A:
"""
        
        print("Sending request to Gemini API...")  # Debug log
        response = model.generate_content(prompt)
        print("Gemini API response received")  # Debug log
        
        return jsonify({'answer': response.text})
        
    except Exception as e:
        print(f" Error in /ask route: {str(e)}")
        print("Full traceback:")
        traceback.print_exc()
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'gemini_configured': model is not None,
        'api_key_present': bool(os.getenv("GEMINI_API_KEY"))
    })

if __name__ == '__main__':
    app.run(debug=True)
