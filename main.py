
import json
import math
import os
import cv2
import shutil

from PIL import Image
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.applications import DenseNet121
from tensorflow.keras.callbacks import Callback, ModelCheckpoint
from tensorflow.keras.preprocessing.image import (
    ImageDataGenerator,
    array_to_img,
    img_to_array,
    load_img
)
from tensorflow.keras.models import Sequential
from tensorflow.keras.optimizers import Adam

import matplotlib.pyplot as plt
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import cohen_kappa_score, accuracy_score
import scipy
from tqdm import tqdm

np.random.seed(2019)
tf.random.set_seed(2019)

print("All libraries imported successfully!")
print("TensorFlow version:", tf.__version__)


# Cell 2: Balance the dataset and generate augmented images

import os
import shutil
import pandas as pd
from tensorflow.keras.preprocessing.image import (
    ImageDataGenerator,
    load_img,
    img_to_array
)

# 1. Set local dataset paths
csv_path = r"D:\project\DR_grading.csv"
image_dir = r"D:\project\DR_grading\DR_grading"
output_dir = r"D:\project\ddr-equal"

train_images_dir = os.path.join(output_dir, "train_images")
aug_images_dir = os.path.join(output_dir, "aug_images")

os.makedirs(train_images_dir, exist_ok=True)
os.makedirs(aug_images_dir, exist_ok=True)

# 2. Read the labels
data = pd.read_csv(csv_path)

# Keep at most 236 original images per grade
LABEL_SIZE = 236
count = [0, 0, 0, 0, 0]
rows = []

# 3. Select balanced original images
for _, row in data.iterrows():
    id_code = str(row["id_code"])
    diagnosis = int(row["diagnosis"])

    source_file_path = os.path.join(image_dir, id_code)
    destination_file_path = os.path.join(train_images_dir, id_code)

    if (
        0 <= diagnosis <= 4
        and count[diagnosis] < LABEL_SIZE
        and os.path.isfile(source_file_path)
    ):
        shutil.copy2(source_file_path, destination_file_path)
        rows.append([id_code, diagnosis])
        count[diagnosis] += 1

# Save the selected original-image labels
columns = ["id_code", "diagnosis"]
df = pd.DataFrame(rows, columns=columns)

train_csv_path = os.path.join(output_dir, "train.csv")
df.to_csv(train_csv_path, index=False)

print("Original images selected per grade:", count)
print("Total original images selected:", len(df))

# 4. Configure image augmentation
datagen = ImageDataGenerator(
    zoom_range=0.15,
    fill_mode="constant",
    cval=0.0,
    horizontal_flip=True,
    vertical_flip=True
)

# Clear old generated images to avoid mixing results from previous runs
for filename in os.listdir(aug_images_dir):
    file_path = os.path.join(aug_images_dir, filename)
    if os.path.isfile(file_path):
        os.remove(file_path)

# 5. Generate six augmented images per selected original
for _, row in df.iterrows():
    id_code = str(row["id_code"])
    diagnosis = str(row["diagnosis"])

    image_path = os.path.join(train_images_dir, id_code)

    img = load_img(image_path)
    x = img_to_array(img)
    x = x.reshape((1,) + x.shape)

    generated = 0
    for _ in datagen.flow(
        x,
        batch_size=1,
        save_to_dir=aug_images_dir,
        save_prefix=diagnosis,
        save_format="jpg"
    ):
        generated += 1
        if generated >= 6:
            break

# 6. Create a CSV for augmented images
augmented_rows = []

for filename in os.listdir(aug_images_dir):
    if filename.lower().endswith((".jpg", ".jpeg", ".png")):
        diagnosis = int(filename.split("_")[0])
        augmented_rows.append([filename, diagnosis])

df_augmented = pd.DataFrame(
    augmented_rows,
    columns=["id_code", "diagnosis"]
)

aug_csv_path = os.path.join(output_dir, "aug.csv")
df_augmented.to_csv(aug_csv_path, index=False)

# 7. Load and inspect the generated dataset
train_df = pd.read_csv(aug_csv_path)

print("\nAugmented dataset shape:", train_df.shape)
print("\nImages per grade:")
print(train_df["diagnosis"].value_counts().sort_index())

train_df.head()


def display_samples(df, columns=4, rows=3):
    fig = plt.figure(figsize=(5 * columns, 4 * rows))

    for i in range(min(columns * rows, len(df))):
        image_path = df.loc[i, "id_code"]
        image_id = df.loc[i, "diagnosis"]

        img_path = os.path.join(
            r"D:\project\ddr-equal\aug_images",
            image_path
        )

        img = cv2.imread(img_path)

        if img is None:
            print(f"Could not load image: {img_path}")
            continue

        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        fig.add_subplot(rows, columns, i + 1)
        plt.title(f"Grade: {image_id}")
        plt.imshow(img)
        plt.axis("off")

    plt.tight_layout()
    plt.show()


display_samples(train_df)
