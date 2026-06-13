"""Generate placeholder icons for the Chrome Extension."""

from PIL import Image, ImageDraw, ImageFont
import os

SIZES = [16, 32, 48, 128]
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'icons')

def generate_icon(size):
    """Generate a simple colored icon with the letter 'A'."""
    img = Image.new('RGB', (size, size), color='#0A66C2')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple 'A' shape
    margin = size // 4
    # Letter A
    draw.text((margin, margin // 2), 'A', fill='white')
    
    return img

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    for size in SIZES:
        img = generate_icon(size)
        filename = f'icon{size}.png'
        filepath = os.path.join(OUTPUT_DIR, filename)
        img.save(filepath)
        print(f'Generated: {filepath}')

if __name__ == '__main__':
    main()