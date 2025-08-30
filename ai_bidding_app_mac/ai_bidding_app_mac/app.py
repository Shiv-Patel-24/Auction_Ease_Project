from flask import Flask, request, jsonify
import joblib
import pandas as pd
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
# Load the models
start_model = joblib.load('start_bid_model.pkl')
max_model = joblib.load('max_bid_model.pkl')

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()

    try:
        input_df = pd.DataFrame([data])

        # Predict start and max bid
        start_price = start_model.predict(input_df)[0]
        max_price = max_model.predict(input_df)[0]

        return jsonify({
            'suggested_start_bid': round(float(start_price), 2),
            'estimated_max_bid': round(float(max_price), 2)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/', methods=['GET'])
def home():
    return "🧠 AI Bidding API is running!"

if __name__ == '__main__':
    app.run(debug=True, port=5000)
