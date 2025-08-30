import pandas as pd
import xgboost as xgb
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_squared_error
import joblib

# Load dataset
df = pd.read_csv('auction_data.csv')

# Features and targets
X = df.drop(['start_price', 'max_price'], axis=1)
y_start = df['start_price']
y_max = df['max_price']

# Define categorical and numerical columns
cat_cols = ['category', 'brand', 'condition']
num_cols = ['item_age_months', 'description_length', 'seller_rating', 'historical_views', 'similar_items']

# Preprocessing pipeline
preprocessor = ColumnTransformer([
    ('cat', OneHotEncoder(handle_unknown='ignore'), cat_cols)
], remainder='passthrough')

# Define model pipelines
start_model = Pipeline([
    ('preprocess', preprocessor),
    ('xgb', xgb.XGBRegressor(n_estimators=100, learning_rate=0.1, random_state=42))
])

max_model = Pipeline([
    ('preprocess', preprocessor),
    ('xgb', xgb.XGBRegressor(n_estimators=100, learning_rate=0.1, random_state=42))
])

# Train-test split
X_train, X_test, y_start_train, y_start_test, y_max_train, y_max_test = train_test_split(
    X, y_start, y_max, test_size=0.2, random_state=42
)

# Train models
start_model.fit(X_train, y_start_train)
max_model.fit(X_train, y_max_train)

# Evaluate
pred_start = start_model.predict(X_test)
pred_max = max_model.predict(X_test)

rmse_start = np.sqrt(mean_squared_error(y_start_test, pred_start))
rmse_max = np.sqrt(mean_squared_error(y_max_test, pred_max))

print(f"Start Bid RMSE: {rmse_start:.2f}")
print(f"Max Bid RMSE: {rmse_max:.2f}")

# Save models
joblib.dump(start_model, 'start_bid_model.pkl')
joblib.dump(max_model, 'max_bid_model.pkl')
print("Models saved as 'start_bid_model.pkl' and 'max_bid_model.pkl'")
