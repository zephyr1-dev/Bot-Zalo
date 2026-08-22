function changeColor() {
  const gradients = Array.from({ length: 25 }, (_, i) => `--gradient-${i + 1}`);
  const textGradients = Array.from(
    { length: 25 },
    (_, i) => `--text-gradient-${i + 1}`
  );

  const randomGradient =
    gradients[Math.floor(Math.random() * gradients.length)];
  const randomTextGradient =
    textGradients[Math.floor(Math.random() * textGradients.length)];

  document.documentElement.style.setProperty(
    "--gradient-current",
    `var(${randomGradient})`
  );
  document.documentElement.style.setProperty(
    "--text-gradient-current",
    `var(${randomTextGradient})`
  );
}

document.querySelector(".color-change").addEventListener("click", changeColor);
