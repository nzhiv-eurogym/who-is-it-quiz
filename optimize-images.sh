#!/bin/bash

set -e

SOURCE_DIR="img"
BACKUP_DIR="img-original"
OUTPUT_DIR="img-optimized"

if ! command -v convert &> /dev/null; then
  echo "ImageMagick не найден. Установи его:"
  echo "sudo apt update && sudo apt install imagemagick"
  exit 1
fi

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Папка img не найдена."
  exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
  echo "Создаю backup: $BACKUP_DIR"
  cp -r "$SOURCE_DIR" "$BACKUP_DIR"
else
  echo "Backup уже существует: $BACKUP_DIR"
fi

rm -rf "$OUTPUT_DIR"
mkdir "$OUTPUT_DIR"

echo "Оптимизирую картинки..."

for file in "$SOURCE_DIR"/*.{jpg,jpeg,JPG,JPEG,png,PNG}; do
  [ -e "$file" ] || continue

  filename=$(basename "$file")
  name="${filename%.*}"

  if convert "$file" \
    -resize 1200x1200\> \
    -quality 78 \
    "$OUTPUT_DIR/$name.jpg"; then

    echo "✓ $filename"
  else
    echo "⚠️ Пропущен проблемный файл: $filename"
  fi
done

echo ""
echo "Размеры папок:"
du -sh "$SOURCE_DIR"
du -sh "$OUTPUT_DIR"

echo ""
echo "Готово."
echo "Проверь качество в папке $OUTPUT_DIR."
echo "Если всё хорошо, замени папку:"
echo "mv img img-heavy"
echo "mv img-optimized img"
