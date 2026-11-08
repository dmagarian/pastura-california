# Pastura California

A one-page website concept for Pastura California, a video production crew and farm in Norco, CA.

The page opens as a camera viewfinder, with a REC light, running timecode, and an audio meter. The colors and lettering come from the Pastura logo.

## Run it

It's plain HTML, CSS, and JavaScript, so there's no build step.

```sh
python3 -m http.server 8765
```

Then open http://localhost:8765.

## Files

- `index.html` has the page content.
- `styles.css` has the layout, colors, and type.
- `main.js` runs the timecode, the background music, and the booking form.
- `assets/` holds the logo, photos, and self-hosted fonts (Big Shoulders Display and Source Serif 4).

## Notes

- The background music is an acoustic guitar loop that the browser synthesizes, so there's no audio file to license. It stays off until a visitor turns it on.
- The booking form opens an email draft. Set `CONTACT_EMAIL` at the top of `main.js` to enable it.
- The photos are placeholder crops from Pastura's Instagram. Replace them with full-resolution stills before launch.
