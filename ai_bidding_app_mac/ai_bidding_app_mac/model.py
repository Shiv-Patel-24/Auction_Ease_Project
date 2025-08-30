import pandas as pd
import numpy as np
import random

categories = ['Electronics', 'Furniture', 'Books', 'Fashion', 'Antiques']
brands = {
    'Electronics': ['Apple', 'Samsung', 'Sony'],
    'Furniture': ['IKEA', 'Nilkamal'],
    'Books': ['Penguin', 'HarperCollins'],
    'Fashion': ['Zara', 'H&M'],
    'Antiques': ['NoBrand']
}
conditions = ['New', 'Used', 'Refurbished']

data = []

for _ in range(500):
    cat = random.choice(categories)
    brand = random.choice(brands[cat])
    condition = random.choice(conditions)
    age = np.random.randint(0, 60) if condition != 'New' else 0
    desc_len = np.random.randint(20, 300)
    rating = round(np.random.uniform(3.0, 5.0), 1)
    views = np.random.randint(20, 1000)
    similar = np.random.randint(0, 10)

    base_price = np.random.randint(500, 20000)
    multiplier = 1.2 if condition == 'New' else (0.9 if condition == 'Used' else 1.0)
    start_price = round(base_price * multiplier, -2)
    max_price = round(start_price + np.random.uniform(0.1, 1.5) * start_price, -2)

    data.append([cat, brand, condition, age, desc_len, rating, views, similar, start_price, max_price])

df = pd.DataFrame(data, columns=[
    'category', 'brand', 'condition', 'item_age_months', 'description_length',
    'seller_rating', 'historical_views', 'similar_items', 'start_price', 'max_price'
])

df.to_csv('auction_data.csv', index=False)
print("Dataset created and saved as 'auction_data.csv'")
