// Video player alternative source switching
document.addEventListener('DOMContentLoaded', function() {
  const altSourceBtns = document.querySelectorAll('.alt-source-btn');
  
  altSourceBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const newUrl = this.getAttribute('data-url');
      const videoContainer = this.closest('.video-sources');
      
      if (!videoContainer) return;
      
      const videoPlayer = videoContainer.querySelector('.video-player iframe');
      
      if (videoPlayer && newUrl) {
        // Update iframe src with new URL
        videoPlayer.src = '/player.html?url=' + encodeURIComponent(newUrl);
        
        // Update active button state
        const siblingBtns = this.parentElement.querySelectorAll('.alt-source-btn');
        siblingBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
      }
    });
  });
});
