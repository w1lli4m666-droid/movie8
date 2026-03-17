// Video player alternative source switching
document.addEventListener('DOMContentLoaded', function() {
  console.log('Video player script loaded');
  
  const altSourceBtns = document.querySelectorAll('.alt-source-btn');
  console.log('Found', altSourceBtns.length, 'source buttons');
  
  altSourceBtns.forEach((btn, index) => {
    console.log('Button', index, ':', btn.textContent, 'URL:', btn.getAttribute('data-url'));
    
    btn.addEventListener('click', function() {
      console.log('Button clicked:', this.textContent);
      
      const newUrl = this.getAttribute('data-url');
      const videoContainer = this.closest('.video-sources');
      
      console.log('New URL:', newUrl);
      console.log('Video container found:', !!videoContainer);
      
      if (!videoContainer) {
        console.error('Could not find .video-sources container');
        return;
      }
      
      const videoPlayer = videoContainer.querySelector('.video-player iframe');
      console.log('Video player iframe found:', !!videoPlayer);
      
      if (videoPlayer && newUrl) {
        const newSrc = '/player.html?url=' + encodeURIComponent(newUrl);
        console.log('Setting new iframe src:', newSrc);
        
        // Update iframe src with new URL
        videoPlayer.src = newSrc;
        
        // Update active button state
        const siblingBtns = this.parentElement.querySelectorAll('.alt-source-btn');
        siblingBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        console.log('Source switched successfully');
      } else {
        console.error('Missing video player or URL');
      }
    });
  });
  
  // 添加 iframe 加载事件监听
  const iframes = document.querySelectorAll('.video-player iframe');
  iframes.forEach((iframe, index) => {
    iframe.addEventListener('load', function() {
      console.log('Iframe', index, 'loaded:', this.src);
    });
    
    iframe.addEventListener('error', function() {
      console.error('Iframe', index, 'error:', this.src);
    });
  });
});
