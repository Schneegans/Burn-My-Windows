# Notes for `claws.blend`

This is the source file for `resources/img/claws.png`. To generate the image, the animation in `claws.blend` is rendered to 256 PNG files and then combined using this command:

```bash
convert *.png -average claws.png
```