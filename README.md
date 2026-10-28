# FilmTogether

**FilmTogether: Cinematic Video Generation from Low-Cost Inputs**

Project repository for FilmTogether and the CineCraft-120K paired video dataset.

## Resources

- [Project page and video demos](https://shiying-zhang.github.io/FilmTogether/)
- [Paper PDF](https://shiying-zhang.github.io/FilmTogether/assets/paper/FilmTogether.pdf)
- [CineCraft-120K dataset on Hugging Face](https://huggingface.co/datasets/Anna-SY/CineCraft-120K)

## Video showcase

The project page contains 10 curated CineCraft-Bench examples and two real-world
demonstrations (basketball and piano). Input/output pairs play synchronously;
high-cost dataset references are separately labelled, not presented as model
outputs. All 34 clips are compressed, muted web previews with full durations.

This is a qualitative showcase, not a replacement for the full evaluation set.
Benchmark examples use the existing exp5 step6000 outputs with 20 denoising steps.

## Website source

`docs/` is a self-contained static page, deployed through GitHub Pages. All video
and poster paths are relative; no runtime API or account login is needed.

To preview locally:

```bash
python3 -m http.server 8000 --directory docs
```

## Release status

The project-page source and selected video assets are available here. Model
training/inference code and the full paired-video dataset are being prepared for
release; their availability should not be inferred from this showcase snapshot.
