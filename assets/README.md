# `claws.blend`

This is the source file for `resources/img/claws.png`. To generate the image, the animation in `claws.blend` is rendered to 256 PNG files and then combined using this command:

```bash
convert *.png -average claws.png
```

# `brush.blend`

This is the source file for `resources/img/brush.png`. To generate the image, the four dynamic paint image sequences in `brush.blend` are baked to 256 PNG files each. They are then combined using these commands:

```bash
convert brush1/*.png -average brush1.png
convert brush2/*.png -average brush2.png
convert brush3/*.png -average brush3.png
convert brush4/*.png -average brush4.png

convert brush1.png brush2.png brush3.png brush4.png -channel RGBA -combine brush.png
```
