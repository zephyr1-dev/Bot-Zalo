document.addEventListener("DOMContentLoaded", function () {
  const menuToggle = document.getElementById('menuToggle');
  const sideMenu = document.getElementById('sideMenu');
  const body = document.body;
  const colorChange = document.getElementById('colorChange');

  menuToggle.addEventListener('click', function(event) {
    event.stopPropagation();
    body.classList.toggle('menu-open');
    sideMenu.classList.toggle('active');

    // Thêm hiệu ứng mượt hơn cho nút đổi màu
    if (body.classList.contains('menu-open')) {
      colorChange.style.opacity = '0';
      colorChange.style.visibility = 'hidden';
      colorChange.style.transform = 'translateX(-20px)';
    } else {
      setTimeout(() => {
        colorChange.style.opacity = '1';
        colorChange.style.visibility = 'visible';
        colorChange.style.transform = 'translateX(0)';
      }, 150);
    }
  });

  // Đóng menu khi click bên ngoài
  document.addEventListener('click', function(event) {
    const isClickInsideMenu = sideMenu.contains(event.target);
    const isClickOnToggle = menuToggle.contains(event.target);

    if (!isClickInsideMenu && !isClickOnToggle && body.classList.contains('menu-open')) {
      body.classList.remove('menu-open');
      sideMenu.classList.remove('active');

      // Hiện nút đổi màu khi đóng menu với hiệu ứng mượt hơn
      setTimeout(() => {
        colorChange.style.opacity = '1';
        colorChange.style.visibility = 'visible';
        colorChange.style.transform = 'translateX(0)';
      }, 150);
    }
  });
});
