# train.py - Train Logistic Regression model on hotel reviews
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
import pickle

# TODO: Load dataset from data/
# df = pd.read_csv('data/hotel_reviews.csv')

print("Training script ready. Add your dataset to data/ folder.")
