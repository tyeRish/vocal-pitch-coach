# 🎤 Vocal Pitch Coach

An interactive web-based vocal training application designed to help you master your vocal range, train different singing styles, and develop your unique voice.

## Features

### 🎵 Training Modes
- **Singing**: Train precision pitch control with tight accuracy requirements
- **Screaming**: Learn controlled vocal distortion and high-energy vocal production
- **Mixed Voice**: Blend chest and head voice for versatile vocal power

### 🎯 Vocal Range Detection
- Automatically detect your lowest and highest notes
- Identifies your voice type (Bass, Baritone, Tenor, Contralto, Mezzo-Soprano, Soprano)
- Shows your total vocal range in octaves
- Helps you understand your natural capabilities

### 📊 Real-Time Feedback
- **Live Pitch Display**: See the note you're singing in real-time
- **Cents Display**: Measure how far off you are from the target note (±50 cents)
- **Visual Indicator**: A guided bar shows your pitch position relative to the target
- **Accuracy Score**: Percentage-based accuracy rating
- **Stability Meter**: Track how stable your pitch is
- **Frequency & Volume**: Technical metrics for detailed feedback

### 🎸 Target Voice Profiles
Train your voice to sound like legendary singers:
- **Chester Bennington** (E2 - G4): Dynamic range perfect for emotional vocal delivery
- **Freddie Mercury** (F#2 - A4): Operatic range with powerful control
- **Custom**: Set your own target range

### 📈 Pitch History Chart
- Live streaming graph showing your pitch over time
- Visual comparison with your target range
- Helps identify patterns and progress

## How to Use

### Getting Started
1. **Start Listening**: Click the "Start Listening" button to begin training
2. **Choose Your Mode**: Select between Singing, Screaming, or Mixed Voice
3. **Pick a Target**: Choose Chester, Freddie, or set Custom targets
4. **Start Vocalizing**: Sing or scream into your microphone

### Detect Your Vocal Range
1. Click **"Detect My Range"** button
2. Sing your **lowest note** for a few seconds
3. Sing your **highest note** for a few seconds
4. The app will show you your vocal range and voice type

### Training Tips
- **Warm up**: Always warm up your voice before intensive training
- **Stay hydrated**: Drink water throughout your training session
- **Focus on accuracy**: The green zone shows ±25 cents (singing mode) of accuracy
- **Build gradually**: Start with comfortable notes and expand your range slowly
- **Monitor stability**: Use the stability meter to track consistency

## Understanding the Metrics

### Cents
One semitone = 100 cents. Shows how many cents sharp (+) or flat (-) you are:
- **±10 cents**: Excellent accuracy (in-key - green)
- **±25-50 cents**: Acceptable range depending on mode
- **Beyond**: Off-key (red)

### Accuracy Score
Percentage rating based on how close you are to the target pitch:
- **90-100%**: Perfect
- **75-90%**: Excellent
- **50-75%**: Good
- **Below 50%**: Needs improvement

### Stability
Measures how consistent your pitch is over the last 10 samples:
- **90-100%**: Very stable
- **70-90%**: Stable
- **50-70%**: Somewhat unstable
- **Below 50%**: Very unstable

## Voice Types Reference

### Male Voices
- **Bass**: Lowest male voice (E1-E3)
- **Baritone**: Middle male voice (A1-A3)
- **Tenor**: Highest male voice (C2-C4)

### Female Voices
- **Contralto**: Lowest female voice (F2-F4)
- **Mezzo-Soprano**: Middle female voice (A2-A4)
- **Soprano**: Highest female voice (C3-C5)

## Technical Details

### Audio Processing
- FFT Size: 4096 samples for high accuracy
- Pitch Detection: Autocorrelation algorithm
- Update Rate: ~60 FPS for real-time feedback
- Smoothing: 0.85 for natural pitch tracking

### Browser Requirements
- Modern browser with Web Audio API support
- Microphone access (required for training)
- JavaScript enabled

## Tips for Best Results

1. **Use a quiet environment**: Background noise affects pitch detection
2. **Position microphone correctly**: Keep it at a consistent distance from your mouth
3. **Sing with confidence**: Weak vocals may not be detected
4. **Start with the range detection**: Understanding your range helps set realistic targets
5. **Practice regularly**: Consistency is key to vocal improvement

## Chester Bennington Voice Profile

Chester Bennington was known for his:
- **Emotional depth**: Dynamic range from whispers to powerful screams
- **Technical control**: Precise pitch accuracy even at extreme volumes
- **Versatility**: Ability to blend singing and screaming seamlessly
- **Extended range**: Comfortable from deep lows (E2) to high soaring notes (G4)

Training to Chester's profile will help you develop:
- Better breath control
- Improved pitch accuracy
- More powerful vocal projection
- Greater emotional expression

## License

MIT License - Feel free to use and modify for your vocal training journey!

---

**Remember**: Vocal training should be done carefully. If you experience pain or discomfort, stop immediately and consult a vocal coach or doctor. This app is a practice tool, not a substitute for professional vocal instruction.
