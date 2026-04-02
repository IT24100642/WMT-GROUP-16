from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/')
def home():
    return "ML Service Running"

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    review = data.get('review', '')
    # TODO: Load model and predict
    return jsonify({"sentiment": "positive", "review": review})

if __name__ == '__main__':
    app.run(port=8000, debug=True)
