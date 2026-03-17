/**
 * 视频播放器增强功能 - 核心模块
 * 实现单播放器模式、集数导航、视频源管理等功能
 */

// 核心数据结构定义
class VideoData {
  constructor(data) {
    this.type = data.type; // 'movie' | 'series'
    this.label = this.validateAndFormatLabel(data.label, data.type);
    
    if (data.type === 'movie') {
      this.name = data.name;
      this.url = data.url;
      this.alternatives = data.alternatives || [];
    } else if (data.type === 'series') {
      this.seasons = data.seasons || [];
      // 兼容旧格式
      if (data.episodes && !data.seasons.length) {
        this.seasons = [{
          season_number: 1,
          season_title: data.label || '第一季',
          episodes: data.episodes
        }];
      }
    }
  }
  
  // 验证和格式化视频标签
  validateAndFormatLabel(label, type) {
    // 如果没有提供标签，使用默认值
    if (!label || typeof label !== 'string') {
      return type === 'movie' ? '电影' : '连续剧';
    }
    
    // 去除首尾空格
    label = label.trim();
    
    // 验证长度（1-20个字符）
    if (label.length === 0) {
      console.warn('Video label cannot be empty, using default');
      return type === 'movie' ? '电影' : '连续剧';
    }
    
    if (label.length > 20) {
      console.warn('Video label too long, truncating to 20 characters');
      label = label.substring(0, 20);
    }
    
    // 验证字符（允许中文、英文、数字、常用标点）
    const validPattern = /^[\u4e00-\u9fa5a-zA-Z0-9\s\-_.,!?()（）【】《》""''：:；;、。]+$/;
    if (!validPattern.test(label)) {
      console.warn('Video label contains invalid characters, using default');
      return type === 'movie' ? '电影' : '连续剧';
    }
    
    return label;
  }
  
  // 获取显示用的标签
  getDisplayLabel() {
    return this.label;
  }
  
  // 更新标签
  updateLabel(newLabel) {
    this.label = this.validateAndFormatLabel(newLabel, this.type);
    return this.label;
  }
  
  // 获取所有集数的扁平化列表
  getAllEpisodes() {
    if (this.type === 'movie') {
      return [{
        id: 'movie',
        number: '电影',
        title: this.label,
        name: this.name,
        url: this.url,
        alternatives: this.alternatives,
        season_number: 1
      }];
    }
    
    const episodes = [];
    this.seasons.forEach(season => {
      season.episodes.forEach((episode, index) => {
        episodes.push({
          id: `s${season.season_number.toString().padStart(2, '0')}e${(index + 1).toString().padStart(2, '0')}`,
          number: episode.number,
          title: episode.title || '',
          name: episode.name,
          url: episode.url,
          alternatives: episode.alternatives || [],
          season_number: season.season_number,
          season_title: season.season_title
        });
      });
    });
    return episodes;
  }
}

// 视频播放系统核心类
class VideoPlayerSystem {
  constructor(containerId, videoData, options = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    
    // 初始化兼容性处理器
    this.compatibilityHandler = new VideoCompatibilityHandler({
      enableAutoMigration: options.enableAutoMigration !== false,
      preserveOldFormat: options.preserveOldFormat !== false,
      logMigrations: options.logMigrations !== false
    });
    
    // 初始化错误处理器
    this.errorHandler = new VideoErrorHandler({
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 2000,
      enableAutoRecovery: options.enableAutoRecovery !== false,
      logErrors: options.logErrors !== false,
      showUserFriendlyMessages: options.showUserFriendlyMessages !== false
    });
    
    // 初始化性能优化组件
    if (options.enableLazyLoading !== false) {
      this.lazyLoader = new EpisodeLazyLoader({
        threshold: options.lazyLoadThreshold || 0.1,
        loadBatchSize: options.lazyLoadBatchSize || 5
      });
    }
    
    if (options.enablePreloading !== false) {
      this.preloader = new VideoPreloader({
        maxConcurrentPreloads: options.maxConcurrentPreloads || 2,
        preloadNextEpisodes: options.preloadNextEpisodes || 1
      });
    }
    
    if (options.enableCaching !== false) {
      this.cache = new VideoCache({
        maxCacheSize: options.maxCacheSize || 100 * 1024 * 1024,
        maxCacheEntries: options.maxCacheEntries || 50
      });
    }
    
    if (options.enableNetworkMonitoring !== false) {
      this.networkMonitor = new NetworkMonitor({
        checkInterval: options.networkCheckInterval || 30000,
        enableSpeedTest: options.enableSpeedTest || false
      });
      
      // 监听网络状态变化
      this.networkMonitor.on('statusChange', (data) => {
        this.handleNetworkStatusChange(data);
      });
      
      this.networkMonitor.on('qualityRecommendation', (recommendations) => {
        this.handleQualityRecommendation(recommendations);
      });
    }
    
    // 处理兼容性和数据迁移
    this.originalVideoData = videoData;
    this.videoData = this.processVideoData(videoData);
    
    this.options = {
      autoplay: false,
      volume: 0.7,
      enableProgressManager: true,
      ...options
    };
    
    this.currentEpisode = null;
    this.currentSource = 'primary';
    this.artPlayer = null;
    this.episodes = this.videoData ? this.videoData.getAllEpisodes() : [];
    
    // 组件实例
    this.episodeNavigation = null;
    this.sourceManager = null;
    this.progressManager = null;
    
    // 事件监听器
    this.eventListeners = new Map();
    
    // 初始化进度管理器
    if (this.options.enableProgressManager) {
      this.initializeProgressManager();
    }
    
    this.init();
  }
  
  // 处理视频数据和兼容性
  processVideoData(rawData) {
    if (!rawData) {
      console.error('VideoPlayerSystem: No video data provided');
      return null;
    }
    
    // 检查是否需要迁移
    if (this.compatibilityHandler.needsMigration(rawData)) {
      console.log('VideoPlayerSystem: Migrating legacy video data format');
      
      const migratedData = this.compatibilityHandler.migrateToNewFormat(rawData);
      if (migratedData) {
        const validation = this.compatibilityHandler.validateMigratedData(migratedData);
        if (validation.valid) {
          return new VideoData(migratedData);
        } else {
          console.error('VideoPlayerSystem: Migration validation failed:', validation.errors);
          // 尝试使用原始数据的兼容模式
          return this.createFallbackVideoData(rawData);
        }
      } else {
        console.error('VideoPlayerSystem: Failed to migrate video data');
        return this.createFallbackVideoData(rawData);
      }
    } else {
      // 数据已经是新格式
      return new VideoData(rawData);
    }
  }
  
  // 创建回退的视频数据对象
  createFallbackVideoData(rawData) {
    try {
      // 尝试创建最基本的兼容数据结构
      if (typeof rawData === 'string' && rawData.includes('<iframe')) {
        // iframe 嵌入格式的回退处理
        return {
          type: 'movie',
          label: '视频',
          getAllEpisodes: () => [{
            id: 'fallback',
            number: '视频',
            title: '',
            name: '播放',
            url: rawData, // 保持原始 iframe
            alternatives: [],
            season_number: 1,
            isIframe: true
          }]
        };
      } else if (rawData.url) {
        // 简单 URL 格式的回退处理
        return {
          type: 'movie',
          label: rawData.label || '视频',
          getAllEpisodes: () => [{
            id: 'fallback',
            number: rawData.label || '视频',
            title: '',
            name: rawData.name || '主源',
            url: rawData.url,
            alternatives: rawData.alternatives || [],
            season_number: 1
          }]
        };
      }
    } catch (error) {
      console.error('VideoPlayerSystem: Failed to create fallback data:', error);
    }
    
    return null;
  }
  
  initializeProgressManager() {
    this.progressManager = new PlaybackProgressManager({
      storageKey: 'video_progress',
      autoSaveInterval: 10000,
      watchedThreshold: 0.9
    });
    
    // 监听进度更新
    this.progressManager.onProgressUpdate((data) => {
      this.emit('progressUpdated', data);
    });
    
    // 监听观看状态变化
    this.progressManager.onWatchedStatusChange((data) => {
      if (data.watched && this.episodeNavigation) {
        this.episodeNavigation.markWatchedEpisode(data.episodeId);
      }
      this.emit('watchedStatusChanged', data);
    });
  }
  
  init() {
    if (!this.container) {
      console.error(`Container with id "${this.containerId}" not found`);
      return;
    }
    
    this.createPlayerHTML();
    this.initializePlayer();
    this.setupEventListeners();
    
    // 初始化集数导航
    this.initializeEpisodeNavigation();
    
    // 初始化视频源管理器
    this.initializeSourceManager();
    
    // 设置组件间通信
    this.setupComponentCommunication();
    
    // 加载上次观看的集数或默认第一集
    this.loadInitialEpisode();
    
    // 触发初始化完成事件
    this.emit('initialized', {
      episodeCount: this.episodes.length,
      hasMultipleSources: this.episodes.some(ep => ep.alternatives && ep.alternatives.length > 0),
      compatibilityMode: this.isUsingCompatibilityMode(),
      features: this.getEnabledFeatures()
    });
  }
  
  // 设置组件间通信
  setupComponentCommunication() {
    // 集数导航与播放器通信
    if (this.episodeNavigation) {
      this.episodeNavigation.on('episodeClick', (data) => {
        this.switchEpisode(data.episodeId);
      });
      
      // 传递懒加载器引用
      if (this.lazyLoader) {
        this.episodeNavigation.lazyLoader = this.lazyLoader;
      }
    }
    
    // 视频源管理器与播放器通信
    if (this.sourceManager) {
      this.sourceManager.on('sourceChange', (data) => {
        if (data.reason !== 'auto-switch') {
          this.switchSource(data.sourceId);
        }
      });
    }
    
    // 进度管理器与播放器通信
    if (this.progressManager) {
      this.progressManager.onProgressUpdate((data) => {
        this.emit('progressUpdated', data);
        
        // 通知集数导航更新进度显示
        if (this.episodeNavigation) {
          this.episodeNavigation.updateEpisodeProgress(data.episodeId, data.progress);
        }
      });
      
      this.progressManager.onWatchedStatusChange((data) => {
        if (data.watched && this.episodeNavigation) {
          this.episodeNavigation.markWatchedEpisode(data.episodeId);
        }
        this.emit('watchedStatusChanged', data);
      });
    }
    
    // 错误处理器与其他组件通信
    if (this.errorHandler) {
      // 监听播放器错误
      this.on('videoError', (error) => {
        this.errorHandler.handleError(error, {
          playerSystem: this,
          container: this.container,
          episodeId: this.currentEpisode,
          sourceId: this.currentSource
        });
      });
    }
    
    // 网络监控器与播放器通信
    if (this.networkMonitor) {
      this.networkMonitor.on('qualityRecommendation', (recommendations) => {
        // 根据网络状况调整预加载策略
        if (this.preloader) {
          this.preloader.options.preloadNextEpisodes = recommendations.preload ? 
            (recommendations.bufferSize === 'large' ? 2 : 1) : 0;
        }
        
        // 通知用户网络状况变化
        this.emit('networkQualityChanged', recommendations);
      });
      
      this.networkMonitor.on('offline', () => {
        this.showNetworkOfflineMessage();
      });
    }
    
    // 预加载器与播放器通信
    if (this.preloader) {
      this.on('episodeChanged', (data) => {
        this.preloader.preloadNextEpisodes(data.episodeId, this.episodes);
      });
    }
  }
  
  // 获取启用的功能列表
  getEnabledFeatures() {
    return {
      episodeNavigation: !!this.episodeNavigation,
      sourceManager: !!this.sourceManager,
      progressManager: !!this.progressManager,
      lazyLoading: !!this.lazyLoader,
      preloading: !!this.preloader,
      caching: !!this.cache,
      networkMonitoring: !!this.networkMonitor,
      errorHandling: !!this.errorHandler,
      compatibilityHandler: !!this.compatibilityHandler
    };
  }
  
  loadInitialEpisode() {
    if (this.episodes.length === 0) return;
    
    let episodeToLoad = this.episodes[0].id;
    
    // 如果启用了进度管理器，尝试加载上次观看的集数
    if (this.progressManager) {
      const lastWatched = this.progressManager.getLastWatchedEpisode();
      if (lastWatched && this.episodes.find(ep => ep.id === lastWatched)) {
        episodeToLoad = lastWatched;
      }
    }
    
    this.loadVideo(episodeToLoad);
  }
  
  createPlayerHTML() {
    this.container.innerHTML = `
      <div class="video-player-container">
        <div class="video-player-wrapper">
          <div id="${this.containerId}-artplayer"></div>
        </div>
        <div class="video-source-selector" style="display: none;">
          <label>视频源：</label>
          <select id="${this.containerId}-source-dropdown">
            <option value="primary">主源</option>
          </select>
        </div>
        <div class="episode-navigation" style="display: none;">
          <!-- 集数导航将由 EpisodeNavigation 组件渲染 -->
        </div>
        <div class="player-controls">
          <button class="reset-progress-btn" title="重置观看记录">
            <span class="reset-icon">↻</span>
            重置观看记录
          </button>
        </div>
      </div>
    `;
  }
  
  initializeEpisodeNavigation() {
    const navigationContainer = this.container.querySelector('.episode-navigation');
    if (!navigationContainer || this.episodes.length <= 1) return;
    
    // 创建集数导航组件
    this.episodeNavigation = new EpisodeNavigation(navigationContainer, this.episodes, {
      showSeasonGroups: this.videoData.type === 'series',
      showWatchProgress: true
    });
    
    // 监听集数点击事件
    this.episodeNavigation.on('episodeClick', (data) => {
      this.switchEpisode(data.episodeId);
    });
    
    // 监听观看状态变化
    this.episodeNavigation.on('episodeWatched', (data) => {
      console.log(`Episode ${data.episodeId} marked as watched`);
    });
    
    // 显示导航区域
    navigationContainer.style.display = 'block';
  }
  
  initializeSourceManager() {
    const sourceContainer = this.container.querySelector('.video-source-selector');
    if (!sourceContainer) return;
    
    // 创建视频源管理组件
    this.sourceManager = new VideoSourceManager(sourceContainer, [], {
      showSourceQuality: true,
      showSourceStatus: true
    });
    
    // 监听视频源切换事件
    this.sourceManager.on('sourceChange', (data) => {
      if (data.reason !== 'auto-switch') {
        this.switchSource(data.sourceId);
      }
    });
    
    // 监听源状态检查完成事件
    this.sourceManager.on('statusCheckCompleted', (data) => {
      console.log('Source status check completed:', data.results);
    });
  }
  
  initializePlayer() {
    const playerContainer = document.getElementById(`${this.containerId}-artplayer`);
    
    if (!playerContainer) {
      console.error('Player container not found');
      return;
    }
    
    // 检查 ArtPlayer 是否可用
    if (typeof Artplayer === 'undefined') {
      console.warn('ArtPlayer not loaded, using iframe fallback');
      this.useIframeFallback(playerContainer);
      return;
    }
    
    try {
      // 检测是否为移动设备
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
      
      // 初始化 ArtPlayer
      this.artPlayer = new Artplayer({
        container: playerContainer,
        url: '', // 初始为空，将在 loadVideo 时设置
        autoSize: false,
        autoMini: true,
        aspectRatio: false,
        setting: true,
        fullscreen: true,
        fullscreenWeb: true,
        pip: true,
        playbackRate: true,
        autoplay: false,
        autoPlayback: true,
        hotkey: true,
        theme: '#e8a020',
        lang: 'zh-cn',
        muted: false,
        volume: this.options.volume || 0.7,
        customType: {
          m3u8: this.setupHLSSupport.bind(this)
        },
        contextmenu: isMobile ? [] : [
          {
            html: '关于 ArtPlayer',
            click: function () {
              window.open('https://artplayer.org');
            },
          },
        ],
      });
      
      this.setupPlayerEvents();
      
      // 移动端优化
      if (isMobile) {
        this.setupMobileOptimizations();
      }
      
    } catch (error) {
      console.error('Failed to initialize ArtPlayer:', error);
      this.showError('播放器初始化失败: ' + error.message);
    }
  }
  
  setupHLSSupport(video, url) {
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      const hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: true,
      });
      
      hls.loadSource(url);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch(data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              console.error('Fatal HLS error:', data);
              hls.destroy();
              this.showError('视频加载失败，请尝试其他视频源');
              break;
          }
        }
      });
      
      // 保存 HLS 实例以便后续使用
      this.hlsInstance = hls;
      
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
    } else {
      this.showError('当前浏览器不支持 HLS 视频格式');
    }
  }
  
  setupPlayerEvents() {
    if (!this.artPlayer) return;
    
    this.artPlayer.on('ready', () => {
      console.log('ArtPlayer ready');
      this.emit('playerReady');
      
      // 恢复播放进度
      this.restorePlaybackProgress();
    });
    
    this.artPlayer.on('video:loadstart', () => {
      this.emit('videoLoadStart');
    });
    
    this.artPlayer.on('video:canplay', () => {
      this.emit('videoCanPlay');
    });
    
    this.artPlayer.on('video:error', (error) => {
      console.error('Video error:', error);
      this.handleVideoError(error);
    });
    
    this.artPlayer.on('video:timeupdate', () => {
      this.saveCurrentProgress();
    });
    
    this.artPlayer.on('video:ended', () => {
      this.handleVideoEnded();
    });
    
    // 播放状态变化
    this.artPlayer.on('video:play', () => {
      this.emit('videoPlay');
    });
    
    this.artPlayer.on('video:pause', () => {
      this.emit('videoPause');
    });
  }
  
  restorePlaybackProgress() {
    if (!this.progressManager || !this.currentEpisode || this.isUsingIframe) return;
    
    const resumePrompt = this.progressManager.getResumePrompt(this.currentEpisode);
    if (resumePrompt) {
      // 显示恢复进度提示
      this.showResumePrompt(resumePrompt);
    }
  }
  
  showResumePrompt(resumePrompt) {
    // 创建恢复进度的提示界面
    const promptOverlay = document.createElement('div');
    promptOverlay.className = 'resume-prompt-overlay';
    promptOverlay.innerHTML = `
      <div class="resume-prompt">
        <p class="resume-message">${resumePrompt.message}</p>
        <div class="resume-actions">
          <button class="resume-btn" data-action="resume">继续观看</button>
          <button class="restart-btn" data-action="restart">从头开始</button>
        </div>
      </div>
    `;
    
    const playerContainer = document.getElementById(`${this.containerId}-artplayer`);
    if (playerContainer) {
      playerContainer.appendChild(promptOverlay);
      
      // 处理按钮点击
      promptOverlay.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        
        if (action === 'resume') {
          this.artPlayer.currentTime = resumePrompt.position;
        } else if (action === 'restart') {
          this.artPlayer.currentTime = 0;
        }
        
        promptOverlay.remove();
        
        // 自动播放（如果启用）
        if (this.options.autoplay) {
          this.artPlayer.play();
        }
      });
      
      // 5秒后自动消失
      setTimeout(() => {
        if (promptOverlay.parentNode) {
          promptOverlay.remove();
        }
      }, 5000);
    }
  }
  
  saveCurrentProgress() {
    if (!this.progressManager || !this.artPlayer || this.isUsingIframe || !this.currentEpisode) return;
    
    const currentTime = this.artPlayer.currentTime;
    const duration = this.artPlayer.duration;
    
    if (currentTime > 0 && duration > 0) {
      this.progressManager.saveEpisodeProgress(this.currentEpisode, currentTime, duration);
    }
  }
  
  handleVideoEnded() {
    // 标记当前集数为已观看
    this.markCurrentEpisodeAsWatched();
    
    // 尝试自动播放下一集
    const nextEpisode = this.getNextEpisode();
    if (nextEpisode) {
      this.showNextEpisodePrompt(nextEpisode);
    }
    
    this.emit('videoEnded');
  }
  
  showNextEpisodePrompt(nextEpisode) {
    const promptOverlay = document.createElement('div');
    promptOverlay.className = 'next-episode-prompt-overlay';
    promptOverlay.innerHTML = `
      <div class="next-episode-prompt">
        <p class="next-message">即将播放下一集</p>
        <p class="next-episode-info">${nextEpisode.number}${nextEpisode.title ? ': ' + nextEpisode.title : ''}</p>
        <div class="next-actions">
          <button class="play-next-btn" data-action="play-next">播放下一集</button>
          <button class="stay-btn" data-action="stay">留在当前集</button>
        </div>
        <div class="countdown">5</div>
      </div>
    `;
    
    const playerContainer = document.getElementById(`${this.containerId}-artplayer`);
    if (playerContainer) {
      playerContainer.appendChild(promptOverlay);
      
      let countdown = 5;
      const countdownElement = promptOverlay.querySelector('.countdown');
      
      const countdownTimer = setInterval(() => {
        countdown--;
        countdownElement.textContent = countdown;
        
        if (countdown <= 0) {
          clearInterval(countdownTimer);
          this.switchEpisode(nextEpisode.id);
          promptOverlay.remove();
        }
      }, 1000);
      
      // 处理按钮点击
      promptOverlay.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        
        clearInterval(countdownTimer);
        
        if (action === 'play-next') {
          this.switchEpisode(nextEpisode.id);
        }
        
        promptOverlay.remove();
      });
    }
  }
  
  setupMobileOptimizations() {
    if (!this.artPlayer) return;
    
    // 移动端双击全屏
    this.artPlayer.on('dblclick', () => {
      this.artPlayer.fullscreen = !this.artPlayer.fullscreen;
    });
    
    // 移动端单击显示/隐藏控制栏
    let clickTimer = null;
    this.artPlayer.on('click', (event) => {
      // 如果点击的是控制栏元素，不处理
      if (event.target.closest('.art-controls') || 
          event.target.closest('.art-progress') ||
          event.target.closest('.art-control')) {
        return;
      }
      
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        this.artPlayer.controls = !this.artPlayer.controls;
      }, 200);
    });
    
    // 双击时清除单击定时器
    this.artPlayer.on('dblclick', () => {
      clearTimeout(clickTimer);
    });
  }
  
  useIframeFallback(container) {
    // 当 ArtPlayer 不可用时，使用 iframe 回退方案
    container.innerHTML = `
      <iframe 
        src="/player.html" 
        width="100%" 
        height="100%" 
        frameborder="0" 
        allowfullscreen
        style="border-radius: 8px;">
      </iframe>
    `;
    
    this.isUsingIframe = true;
  }
  
  handleVideoError(error) {
    console.error('Video playback error:', error);
    
    // 使用错误处理器处理错误
    const context = {
      playerSystem: this,
      container: this.container,
      episodeId: this.currentEpisode,
      sourceId: this.currentSource
    };
    
    this.errorHandler.handleError(error, context).then(result => {
      if (!result.recovered) {
        // 如果自动恢复失败，尝试手动恢复策略
        this.fallbackErrorHandling(error);
      }
    }).catch(handlerError => {
      console.error('Error handler failed:', handlerError);
      this.fallbackErrorHandling(error);
    });
  }
  
  // 回退错误处理（当错误处理器失败时）
  fallbackErrorHandling(error) {
    // 尝试切换到备用源
    const currentEpisode = this.episodes.find(ep => ep.id === this.currentEpisode);
    if (currentEpisode && currentEpisode.alternatives.length > 0) {
      const nextSource = currentEpisode.alternatives.find(alt => alt.name !== this.currentSource);
      if (nextSource) {
        console.log('Trying alternative source:', nextSource.name);
        this.switchSource(nextSource.name);
        return;
      }
    }
    
    // 显示基本错误消息
    this.showError('视频播放失败，请尝试刷新页面或选择其他视频源');
  }
  
  markCurrentEpisodeAsWatched() {
    if (this.currentEpisode) {
      // 使用进度管理器标记为已观看
      if (this.progressManager) {
        const duration = this.artPlayer && !this.isUsingIframe ? this.artPlayer.duration : null;
        this.progressManager.markEpisodeAsWatched(this.currentEpisode, duration);
      }
      
      // 更新集数导航的观看状态
      if (this.episodeNavigation) {
        this.episodeNavigation.markWatchedEpisode(this.currentEpisode);
      }
      
      this.emit('episodeWatched', { episodeId: this.currentEpisode });
    }
  }
  
  showError(message) {
    const playerContainer = document.getElementById(`${this.containerId}-artplayer`);
    if (!playerContainer) return;
    
    const errorOverlay = document.createElement('div');
    errorOverlay.className = 'video-error-overlay';
    errorOverlay.innerHTML = `
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <p class="error-message">${message}</p>
        <button class="retry-btn" onclick="location.reload()">刷新页面</button>
      </div>
    `;
    
    playerContainer.appendChild(errorOverlay);
  }
  
  setupEventListeners() {
    // 视频源选择器事件
    const sourceDropdown = document.getElementById(`${this.containerId}-source-dropdown`);
    if (sourceDropdown) {
      sourceDropdown.addEventListener('change', (e) => {
        this.switchSource(e.target.value);
      });
    }
    
    // 重置观看记录按钮事件
    const resetBtn = this.container.querySelector('.reset-progress-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.showResetProgressConfirm();
      });
    }
  }
  
  showResetProgressConfirm() {
    const confirmOverlay = document.createElement('div');
    confirmOverlay.className = 'confirm-overlay';
    confirmOverlay.innerHTML = `
      <div class="confirm-dialog">
        <h3>重置观看记录</h3>
        <p>确定要清除所有观看进度和记录吗？此操作无法撤销。</p>
        <div class="confirm-actions">
          <button class="confirm-btn" data-action="confirm">确定重置</button>
          <button class="cancel-btn" data-action="cancel">取消</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(confirmOverlay);
    
    confirmOverlay.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      
      if (action === 'confirm') {
        this.clearWatchingProgress();
        this.showResetSuccessMessage();
      }
      
      confirmOverlay.remove();
    });
  }
  
  showResetSuccessMessage() {
    const messageOverlay = document.createElement('div');
    messageOverlay.className = 'message-overlay';
    messageOverlay.innerHTML = `
      <div class="message-dialog">
        <span class="success-icon">✓</span>
        <p>观看记录已重置</p>
      </div>
    `;
    
    document.body.appendChild(messageOverlay);
    
    setTimeout(() => {
      messageOverlay.remove();
    }, 2000);
  }
  
  // 核心播放控制方法
  loadVideo(episodeId, sourceId = 'primary') {
    const episode = this.episodes.find(ep => ep.id === episodeId);
    if (!episode) {
      console.error(`Episode with id "${episodeId}" not found`);
      return;
    }
    
    this.currentEpisode = episodeId;
    this.currentSource = sourceId;
    
    // 获取视频源 URL
    let videoUrl;
    let sourceName;
    
    if (sourceId === 'primary') {
      videoUrl = episode.url;
      sourceName = episode.name || '主源';
    } else {
      const altSource = episode.alternatives.find(alt => alt.name === sourceId);
      if (altSource) {
        videoUrl = altSource.url;
        sourceName = altSource.name;
      } else {
        console.warn(`Alternative source "${sourceId}" not found, using primary`);
        videoUrl = episode.url;
        sourceName = episode.name || '主源';
        this.currentSource = 'primary';
      }
    }
    
    console.log(`Loading video: ${episode.number} - ${sourceName} - ${videoUrl}`);
    
    // 检查是否是 iframe 格式
    if (episode.isIframe || (typeof videoUrl === 'string' && videoUrl.includes('<iframe'))) {
      this.loadIframeVideo(videoUrl);
    } else {
      this.loadArtPlayerVideo(videoUrl);
    }
    
    // 更新视频源选择器
    this.updateSourceSelector(episode);
    
    // 触发事件
    this.emit('videoLoaded', { episode, sourceId, videoUrl, sourceName });
  }
  
  // 加载 iframe 视频
  loadIframeVideo(iframeHtml) {
    const playerContainer = document.getElementById(`${this.containerId}-artplayer`);
    if (!playerContainer) return;
    
    // 如果是完整的 iframe HTML
    if (iframeHtml.includes('<iframe')) {
      playerContainer.innerHTML = iframeHtml;
    } else {
      // 如果是 URL，创建 iframe
      playerContainer.innerHTML = `
        <iframe 
          src="${iframeHtml}" 
          width="100%" 
          height="100%" 
          frameborder="0" 
          allowfullscreen
          style="border-radius: 8px;">
        </iframe>
      `;
    }
    
    this.isUsingIframe = true;
    
    // 禁用进度管理（iframe 无法访问播放状态）
    if (this.progressManager) {
      console.warn('Progress management disabled for iframe videos');
    }
  }
  
  // 加载 ArtPlayer 视频
  loadArtPlayerVideo(videoUrl) {
    // 加载视频到播放器
    if (this.artPlayer && !this.isUsingIframe) {
      try {
        // 检测视频类型
        const videoType = this.getVideoType(videoUrl);
        
        // 更新播放器源
        this.artPlayer.switchUrl(videoUrl, videoType);
        
        // 加载播放进度
        this.loadProgress();
        
        this.isUsingIframe = false;
        
      } catch (error) {
        console.error('Failed to load video in ArtPlayer:', error);
        this.handleVideoError(error);
      }
    } else if (this.isUsingIframe) {
      // 从 iframe 模式切换回 ArtPlayer
      this.isUsingIframe = false;
      this.initializePlayer();
      
      // 延迟加载视频
      setTimeout(() => {
        this.loadArtPlayerVideo(videoUrl);
      }, 500);
    }
  }
  
  getVideoType(url) {
    if (url.includes('.m3u8')) return 'm3u8';
    if (url.includes('.mp4')) return 'mp4';
    if (url.includes('.webm')) return 'webm';
    if (url.includes('.ogg')) return 'ogg';
    return 'auto';
  }
  
  // 播放控制方法
  play() {
    if (this.artPlayer && !this.isUsingIframe) {
      this.artPlayer.play();
    }
  }
  
  pause() {
    if (this.artPlayer && !this.isUsingIframe) {
      this.artPlayer.pause();
    }
  }
  
  switchEpisode(episodeId) {
    const episode = this.episodes.find(ep => ep.id === episodeId);
    if (!episode) {
      console.error(`Episode with id "${episodeId}" not found`);
      return;
    }
    
    // 保存当前播放进度
    this.saveCurrentProgress();
    
    // 切换到新集数
    this.loadVideo(episodeId, 'primary');
    
    // 更新集数导航状态
    if (this.episodeNavigation) {
      this.episodeNavigation.setActiveEpisode(episodeId);
    }
    
    // 预加载下一集
    if (this.preloader) {
      this.preloader.preloadNextEpisodes(episodeId, this.episodes);
    }
    
    // 触发集数切换事件
    this.emit('episodeChanged', { 
      episodeId, 
      episode,
      previousEpisode: this.currentEpisode 
    });
    
    console.log(`Switched to episode: ${episode.number} (${episode.title || 'No title'})`);
  }
  
  switchSource(sourceId) {
    if (!this.currentEpisode) {
      console.warn('No episode loaded, cannot switch source');
      return;
    }
    
    const currentTime = this.getCurrentTime();
    const previousSource = this.currentSource;
    
    try {
      // 切换视频源
      this.loadVideo(this.currentEpisode, sourceId);
      
      // 恢复播放位置
      if (currentTime > 0) {
        setTimeout(() => {
          this.seekTo(currentTime);
        }, 1000); // 等待视频加载
      }
      
      // 更新源管理器状态
      if (this.sourceManager) {
        this.sourceManager.setActiveSource(sourceId);
      }
      
      this.emit('sourceChanged', { 
        sourceId, 
        episodeId: this.currentEpisode,
        previousSource,
        success: true
      });
      
      console.log(`Switched to source: ${sourceId}`);
      
    } catch (error) {
      console.error('Failed to switch source:', error);
      
      // 切换失败，尝试自动切换到最佳源
      if (this.sourceManager) {
        const bestSource = this.sourceManager.getRecommendedSource();
        if (bestSource && bestSource.id !== sourceId && bestSource.id !== previousSource) {
          console.log(`Trying alternative source: ${bestSource.id}`);
          this.switchSource(bestSource.id);
          return;
        }
      }
      
      // 如果没有其他源可用，回退到之前的源
      if (previousSource !== sourceId) {
        console.log(`Falling back to previous source: ${previousSource}`);
        this.loadVideo(this.currentEpisode, previousSource);
      }
      
      this.emit('sourceChanged', { 
        sourceId: previousSource, 
        episodeId: this.currentEpisode,
        previousSource: sourceId,
        success: false,
        error: error.message
      });
      
      this.showError('视频源切换失败，已回退到之前的源');
    }
  }
  
  // 播放位置控制
  getCurrentTime() {
    if (this.artPlayer && !this.isUsingIframe) {
      return this.artPlayer.currentTime || 0;
    }
    return 0;
  }
  
  seekTo(time) {
    if (this.artPlayer && !this.isUsingIframe) {
      this.artPlayer.currentTime = time;
    }
  }
  
  // 集数导航辅助方法
  getNextEpisode() {
    if (!this.currentEpisode) return null;
    
    const currentIndex = this.episodes.findIndex(ep => ep.id === this.currentEpisode);
    if (currentIndex >= 0 && currentIndex < this.episodes.length - 1) {
      return this.episodes[currentIndex + 1];
    }
    return null;
  }
  
  getPreviousEpisode() {
    if (!this.currentEpisode) return null;
    
    const currentIndex = this.episodes.findIndex(ep => ep.id === this.currentEpisode);
    if (currentIndex > 0) {
      return this.episodes[currentIndex - 1];
    }
    return null;
  }
  
  playNext() {
    const nextEpisode = this.getNextEpisode();
    if (nextEpisode) {
      this.switchEpisode(nextEpisode.id);
      return true;
    }
    return false;
  }
  
  playPrevious() {
    const previousEpisode = this.getPreviousEpisode();
    if (previousEpisode) {
      this.switchEpisode(previousEpisode.id);
      return true;
    }
    return false;
  }
  
  updateSourceSelector(episode) {
    if (!this.sourceManager) return;
    
    // 构建源列表
    const sources = [
      { 
        id: 'primary', 
        name: episode.name || '主源',
        url: episode.url,
        quality: this.detectQuality(episode.url)
      }
    ];
    
    // 添加备用源
    episode.alternatives.forEach(alt => {
      sources.push({
        id: alt.name,
        name: alt.name,
        url: alt.url,
        quality: this.detectQuality(alt.url)
      });
    });
    
    // 更新源管理器
    this.sourceManager.updateSources(sources);
    this.sourceManager.setActiveSource(this.currentSource);
    
    // 异步检查源状态
    if (sources.length > 1) {
      this.sourceManager.checkAllSourcesStatus().catch(error => {
        console.warn('Failed to check source status:', error);
      });
    }
  }
  
  detectQuality(url) {
    // 简单的质量检测逻辑
    if (url.includes('4k') || url.includes('2160p')) return '4K';
    if (url.includes('1080p') || url.includes('fhd')) return '1080P';
    if (url.includes('720p') || url.includes('hd')) return '720P';
    if (url.includes('480p')) return '480P';
    if (url.includes('360p')) return '360P';
    return null;
  }
  
  // 处理网络状态变化
  handleNetworkStatusChange(data) {
    if (data.online) {
      console.log('VideoPlayerSystem: Network back online');
      
      // 网络恢复，尝试恢复播放
      if (this.artPlayer && this.artPlayer.video && this.artPlayer.video.paused) {
        // 检查是否因为网络问题暂停
        if (this.artPlayer.video.readyState < 3) {
          console.log('VideoPlayerSystem: Attempting to resume playback after network recovery');
          this.artPlayer.play().catch(error => {
            console.warn('VideoPlayerSystem: Failed to resume playback:', error);
          });
        }
      }
      
      this.emit('networkOnline', data);
    } else {
      console.log('VideoPlayerSystem: Network offline');
      
      // 网络断开，暂停播放并显示提示
      if (this.artPlayer && !this.artPlayer.video.paused) {
        this.artPlayer.pause();
      }
      
      this.showNetworkOfflineMessage();
      this.emit('networkOffline', data);
    }
  }
  
  // 处理质量推荐
  handleQualityRecommendation(recommendations) {
    console.log('VideoPlayerSystem: Quality recommendations:', recommendations);
    
    // 根据网络状况调整预加载策略
    if (this.preloader) {
      if (recommendations.preload) {
        this.preloader.options.preloadNextEpisodes = recommendations.bufferSize === 'large' ? 2 : 1;
      } else {
        this.preloader.options.preloadNextEpisodes = 0;
      }
    }
    
    this.emit('qualityRecommendation', recommendations);
  }
  
  // 显示网络离线消息
  showNetworkOfflineMessage() {
    const playerContainer = document.getElementById(`${this.containerId}-artplayer`);
    if (!playerContainer) return;
    
    // 移除现有的离线提示
    const existingMessage = playerContainer.querySelector('.network-offline-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    const offlineMessage = document.createElement('div');
    offlineMessage.className = 'network-offline-message';
    offlineMessage.innerHTML = `
      <div class="offline-content">
        <span class="offline-icon">📶</span>
        <h3>网络连接已断开</h3>
        <p>请检查网络连接，连接恢复后将自动继续播放</p>
      </div>
    `;
    
    playerContainer.appendChild(offlineMessage);
    
    // 监听网络恢复
    const removeMessage = () => {
      if (offlineMessage.parentNode) {
        offlineMessage.remove();
      }
      this.networkMonitor.off('online', removeMessage);
    };
    
    if (this.networkMonitor) {
      this.networkMonitor.on('online', removeMessage);
    }
  }
  // 获取兼容性信息
  getCompatibilityInfo() {
    if (!this.compatibilityHandler || !this.originalVideoData) {
      return null;
    }
    
    return {
      report: this.compatibilityHandler.getCompatibilityReport(this.originalVideoData),
      migrationStats: this.compatibilityHandler.getMigrationStats(),
      originalFormat: this.compatibilityHandler.detectDataFormat(this.originalVideoData),
      currentFormat: this.videoData ? 'v2_processed' : 'failed'
    };
  }
  
  // 获取系统状态
  getSystemStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      player: {
        initialized: !!this.artPlayer,
        currentEpisode: this.currentEpisode,
        currentSource: this.currentSource,
        isPlaying: this.artPlayer && !this.artPlayer.video.paused,
        currentTime: this.getCurrentTime(),
        duration: this.artPlayer ? this.artPlayer.duration : null,
        volume: this.artPlayer ? this.artPlayer.volume : null,
        isUsingIframe: this.isUsingIframe
      },
      episodes: {
        total: this.episodes.length,
        current: this.episodes.findIndex(ep => ep.id === this.currentEpisode),
        hasMultipleSources: this.episodes.some(ep => ep.alternatives && ep.alternatives.length > 0)
      },
      features: this.getEnabledFeatures(),
      performance: {},
      network: null,
      errors: null,
      compatibility: null
    };
    
    // 性能统计
    if (this.cache) {
      status.performance.cache = this.cache.getStats();
    }
    
    if (this.preloader) {
      status.performance.preloader = this.preloader.getCacheStats();
    }
    
    if (this.lazyLoader) {
      status.performance.lazyLoader = {
        loadedEpisodes: this.lazyLoader.loadedEpisodes.size,
        queueLength: this.lazyLoader.loadingQueue.length
      };
    }
    
    // 网络状态
    if (this.networkMonitor) {
      status.network = this.networkMonitor.getNetworkStatus();
    }
    
    // 错误统计
    if (this.errorHandler) {
      status.errors = this.errorHandler.getErrorStats();
    }
    
    // 兼容性信息
    status.compatibility = this.getCompatibilityInfo();
    
    return status;
  }
  
  // 获取性能指标
  getPerformanceMetrics() {
    const metrics = {
      timestamp: Date.now(),
      memory: {},
      cache: {},
      network: {},
      errors: {}
    };
    
    // 内存使用情况（如果支持）
    if (performance.memory) {
      metrics.memory = {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      };
    }
    
    // 缓存统计
    if (this.cache) {
      metrics.cache = this.cache.getStats();
    }
    
    // 网络统计
    if (this.networkMonitor) {
      const networkStatus = this.networkMonitor.getNetworkStatus();
      metrics.network = {
        online: networkStatus.online,
        quality: this.networkMonitor.getConnectionQuality(),
        speed: networkStatus.speed
      };
    }
    
    // 错误统计
    if (this.errorHandler) {
      metrics.errors = this.errorHandler.getErrorStats();
    }
    
    return metrics;
  }
  
  // 获取原始数据（用于调试）
  getOriginalVideoData() {
    return this.originalVideoData;
  }
  
  // 检查是否使用了兼容模式
  isUsingCompatibilityMode() {
    return this.compatibilityHandler && 
           this.compatibilityHandler.needsMigration(this.originalVideoData);
  }
  getCurrentEpisode() {
    return this.currentEpisode;
  }
  
  getCurrentSource() {
    return this.currentSource;
  }
  
  getEpisodeList() {
    return this.episodes;
  }
  
  getAvailableSources() {
    if (this.sourceManager) {
      return this.sourceManager.getAllSources();
    }
    
    // 回退逻辑
    if (!this.currentEpisode) return [];
    
    const episode = this.episodes.find(ep => ep.id === this.currentEpisode);
    if (!episode) return [];
    
    const sources = [{ id: 'primary', name: episode.name || '主源' }];
    episode.alternatives.forEach(alt => {
      sources.push({ id: alt.name, name: alt.name });
    });
    
    return sources;
  }
  
  // 事件系统
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }
  
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }
  
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for "${event}":`, error);
        }
      });
    }
  }
  
  // 播放位置控制
  getCurrentTime() {
    if (this.artPlayer && !this.isUsingIframe) {
      return this.artPlayer.currentTime || 0;
    }
    return 0;
  }
  
  seekTo(time) {
    if (this.artPlayer && !this.isUsingIframe) {
      this.artPlayer.currentTime = time;
    }
  }
  
  // 进度管理相关方法
  getWatchingStats() {
    if (this.progressManager) {
      return this.progressManager.getWatchingStats();
    }
    return null;
  }
  
  clearWatchingProgress(episodeId = null) {
    if (this.progressManager) {
      this.progressManager.clearProgress(episodeId);
      
      // 更新集数导航显示
      if (this.episodeNavigation) {
        if (episodeId) {
          // 清除特定集数的观看状态
          this.episodeNavigation.watchedEpisodes.delete(episodeId);
        } else {
          // 清除所有观看状态
          this.episodeNavigation.clearWatchedStatus();
        }
        this.episodeNavigation.render();
      }
    }
  }
  
  // 响应式处理
  resize() {
    // 播放器尺寸调整逻辑
    if (this.artPlayer && this.artPlayer.resize) {
      this.artPlayer.resize();
    }
  }
  
  // 清理资源
  destroy() {
    // 清理集数导航组件
    if (this.episodeNavigation) {
      this.episodeNavigation.destroy();
      this.episodeNavigation = null;
    }
    
    // 清理视频源管理器
    if (this.sourceManager) {
      this.sourceManager.destroy();
      this.sourceManager = null;
    }
    
    // 清理进度管理器
    if (this.progressManager) {
      this.progressManager.destroy();
      this.progressManager = null;
    }
    
    // 清理性能优化组件
    if (this.lazyLoader) {
      this.lazyLoader.destroy();
      this.lazyLoader = null;
    }
    
    if (this.preloader) {
      this.preloader.destroy();
      this.preloader = null;
    }
    
    if (this.cache) {
      this.cache.destroy();
      this.cache = null;
    }
    
    // 清理网络监控器
    if (this.networkMonitor) {
      this.networkMonitor.destroy();
      this.networkMonitor = null;
    }
    
    // 清理错误处理器
    if (this.errorHandler) {
      this.errorHandler.clearErrorLog();
      this.errorHandler = null;
    }
    
    // 清理兼容性处理器
    if (this.compatibilityHandler) {
      this.compatibilityHandler.clearMigrationLog();
      this.compatibilityHandler = null;
    }
    
    // 清理 HLS 实例
    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }
    
    // 清理 ArtPlayer
    if (this.artPlayer && this.artPlayer.destroy) {
      this.artPlayer.destroy();
      this.artPlayer = null;
    }
    
    this.eventListeners.clear();
    
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// 集数导航组件
class EpisodeNavigation {
  constructor(container, episodes, options = {}) {
    this.container = container;
    this.episodes = episodes;
    this.options = {
      showSeasonGroups: true,
      enableDragSort: false,
      showWatchProgress: true,
      ...options
    };
    
    this.activeEpisode = null;
    this.watchedEpisodes = new Set();
    this.eventListeners = new Map();
    
    // 从本地存储加载观看状态
    this.loadWatchedStatus();
    
    this.render();
  }
  
  render() {
    if (!this.container) return;
    
    const episodesBySeasons = this.groupEpisodesBySeasons();
    
    let html = '';
    
    if (this.options.showSeasonGroups && episodesBySeasons.size > 1) {
      // 多季显示
      episodesBySeasons.forEach((episodes, seasonInfo) => {
        html += this.renderSeasonGroup(seasonInfo, episodes);
      });
    } else {
      // 单季或电影显示
      const allEpisodes = Array.from(episodesBySeasons.values()).flat();
      html += `<div class="episode-cards">${this.renderEpisodeCards(allEpisodes)}</div>`;
    }
    
    this.container.innerHTML = html;
    this.setupEventListeners();
    
    // 显示导航区域
    this.container.style.display = 'block';
    
    // 触发渲染完成事件
    this.emit('rendered', { episodeCount: this.episodes.length });
  }
  
  groupEpisodesBySeasons() {
    const seasonMap = new Map();
    
    this.episodes.forEach(episode => {
      const seasonKey = `${episode.season_number}-${episode.season_title || ''}`;
      if (!seasonMap.has(seasonKey)) {
        seasonMap.set(seasonKey, []);
      }
      seasonMap.get(seasonKey).push(episode);
    });
    
    return seasonMap;
  }
  
  renderSeasonGroup(seasonInfo, episodes) {
    const [seasonNumber, seasonTitle] = seasonInfo.split('-');
    const watchedCount = episodes.filter(ep => this.watchedEpisodes.has(ep.id)).length;
    const totalCount = episodes.length;
    
    return `
      <div class="season-group" data-season="${seasonNumber}">
        <div class="season-header">
          <h3 class="season-title">${seasonTitle || `第${seasonNumber}季`}</h3>
          ${this.options.showWatchProgress ? `
            <span class="season-progress">${watchedCount}/${totalCount} 已观看</span>
          ` : ''}
        </div>
        <div class="episode-cards">
          ${this.renderEpisodeCards(episodes)}
        </div>
      </div>
    `;
  }
  
  renderEpisodeCards(episodes) {
    return episodes.map(episode => this.renderEpisodeCard(episode)).join('');
  }
  
  renderEpisodeCard(episode) {
    const isActive = this.activeEpisode === episode.id;
    const isWatched = this.watchedEpisodes.has(episode.id);
    const hasAlternatives = episode.alternatives && episode.alternatives.length > 0;
    
    return `
      <div class="episode-card ${isActive ? 'active' : ''} ${isWatched ? 'watched' : ''}" 
           data-episode="${episode.id}"
           tabindex="0"
           role="button"
           aria-label="播放 ${episode.number}${episode.title ? ': ' + episode.title : ''}">
        <div class="episode-content">
          <span class="episode-number">${episode.number}</span>
          ${episode.title ? `<span class="episode-title">${episode.title}</span>` : ''}
          ${hasAlternatives ? '<span class="episode-sources-indicator">多源</span>' : ''}
        </div>
        <div class="episode-status">
          <span class="watch-status ${isWatched ? 'watched' : ''}"></span>
          ${isActive ? '<span class="playing-indicator">▶</span>' : ''}
        </div>
      </div>
    `;
  }
  
  setupEventListeners() {
    const episodeCards = this.container.querySelectorAll('.episode-card');
    
    episodeCards.forEach(card => {
      // 设置懒加载
      if (this.lazyLoader) {
        this.lazyLoader.observe(card);
      }
      
      // 点击事件
      card.addEventListener('click', (e) => {
        e.preventDefault();
        const episodeId = card.dataset.episode;
        this.handleEpisodeClick(episodeId);
      });
      
      // 键盘事件（无障碍访问）
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const episodeId = card.dataset.episode;
          this.handleEpisodeClick(episodeId);
        }
      });
      
      // 悬停效果（桌面端）
      if (!this.isMobile()) {
        card.addEventListener('mouseenter', () => {
          this.showEpisodePreview(card);
        });
        
        card.addEventListener('mouseleave', () => {
          this.hideEpisodePreview();
        });
      }
    });
    
    // 响应式布局监听
    window.addEventListener('resize', this.debounce(() => {
      this.updateLayout();
    }, 250));
  }
  
  handleEpisodeClick(episodeId) {
    const episode = this.episodes.find(ep => ep.id === episodeId);
    if (!episode) return;
    
    // 触发集数点击事件
    this.emit('episodeClick', { 
      episodeId, 
      episode,
      previousEpisode: this.activeEpisode 
    });
    
    // 更新活跃状态
    this.setActiveEpisode(episodeId);
  }
  
  setActiveEpisode(episodeId) {
    const previousActive = this.activeEpisode;
    this.activeEpisode = episodeId;
    
    // 更新视觉状态
    const cards = this.container.querySelectorAll('.episode-card');
    cards.forEach(card => {
      const cardEpisodeId = card.dataset.episode;
      
      if (cardEpisodeId === episodeId) {
        card.classList.add('active');
        card.setAttribute('aria-pressed', 'true');
        
        // 添加播放指示器
        const statusDiv = card.querySelector('.episode-status');
        if (statusDiv && !statusDiv.querySelector('.playing-indicator')) {
          statusDiv.innerHTML += '<span class="playing-indicator">▶</span>';
        }
        
        // 滚动到可见区域（移动端）
        if (this.isMobile()) {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      } else {
        card.classList.remove('active');
        card.setAttribute('aria-pressed', 'false');
        
        // 移除播放指示器
        const playingIndicator = card.querySelector('.playing-indicator');
        if (playingIndicator) {
          playingIndicator.remove();
        }
      }
    });
    
    this.emit('activeEpisodeChanged', { 
      episodeId, 
      previousEpisode: previousActive 
    });
  }
  
  markWatchedEpisode(episodeId) {
    this.watchedEpisodes.add(episodeId);
    this.saveWatchedStatus();
    
    const card = this.container.querySelector(`[data-episode="${episodeId}"]`);
    if (card) {
      card.classList.add('watched');
      
      const watchStatus = card.querySelector('.watch-status');
      if (watchStatus) {
        watchStatus.classList.add('watched');
        watchStatus.setAttribute('title', '已观看');
      }
    }
    
    // 更新季度进度显示
    this.updateSeasonProgress();
    
    this.emit('episodeWatched', { episodeId });
  }
  
  updateSeasonProgress() {
    const seasonGroups = this.container.querySelectorAll('.season-group');
    
    seasonGroups.forEach(group => {
      const seasonNumber = group.dataset.season;
      const episodeCards = group.querySelectorAll('.episode-card');
      const watchedCards = group.querySelectorAll('.episode-card.watched');
      
      const progressSpan = group.querySelector('.season-progress');
      if (progressSpan) {
        progressSpan.textContent = `${watchedCards.length}/${episodeCards.length} 已观看`;
      }
    });
  }
  
  loadWatchedStatus() {
    try {
      // 优先从进度管理器加载状态
      if (window.PlaybackProgressManager) {
        const progressManager = new PlaybackProgressManager();
        const watchedEpisodes = progressManager.getWatchedEpisodes();
        
        watchedEpisodes.forEach(episodeId => {
          this.watchedEpisodes.add(episodeId);
        });
        
        progressManager.destroy();
        return;
      }
      
      // 回退到直接读取 localStorage
      const progressKey = `video_progress_${window.location.pathname}`;
      const progressData = JSON.parse(localStorage.getItem(progressKey) || '{}');
      
      if (progressData.episodes) {
        Object.keys(progressData.episodes).forEach(episodeId => {
          if (progressData.episodes[episodeId].watched) {
            this.watchedEpisodes.add(episodeId);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to load watched status:', error);
    }
  }
  
  saveWatchedStatus() {
    try {
      const progressKey = `video_progress_${window.location.pathname}`;
      const progressData = JSON.parse(localStorage.getItem(progressKey) || '{}');
      
      if (!progressData.episodes) {
        progressData.episodes = {};
      }
      
      this.watchedEpisodes.forEach(episodeId => {
        if (!progressData.episodes[episodeId]) {
          progressData.episodes[episodeId] = {};
        }
        progressData.episodes[episodeId].watched = true;
      });
      
      localStorage.setItem(progressKey, JSON.stringify(progressData));
    } catch (error) {
      console.warn('Failed to save watched status:', error);
    }
  }
  
  showEpisodePreview(card) {
    // 桌面端悬停预览功能（可选实现）
    const episodeId = card.dataset.episode;
    const episode = this.episodes.find(ep => ep.id === episodeId);
    
    if (episode && episode.title) {
      card.setAttribute('title', `${episode.number}: ${episode.title}`);
    }
  }
  
  hideEpisodePreview() {
    // 隐藏预览
  }
  
  isMobile() {
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  // 事件系统
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }
  
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }
  
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in episode navigation event listener:`, error);
        }
      });
    }
  }
  
  updateLayout() {
    // 响应式布局更新
    const isMobile = this.isMobile();
    
    if (isMobile) {
      // 移动端：确保横向滚动
      const episodeCards = this.container.querySelectorAll('.episode-cards');
      episodeCards.forEach(cards => {
        cards.classList.add('mobile-scroll');
        
        // 添加滚动结束标记
        if (!cards.querySelector('.scroll-end-marker')) {
          const marker = document.createElement('div');
          marker.className = 'scroll-end-marker';
          cards.appendChild(marker);
        }
        
        // 设置滚动指示器
        this.setupScrollIndicators(cards);
      });
    } else {
      // 桌面端：网格布局
      const episodeCards = this.container.querySelectorAll('.episode-cards');
      episodeCards.forEach(cards => {
        cards.classList.remove('mobile-scroll', 'can-scroll-left', 'can-scroll-right');
        
        // 移除滚动结束标记
        const marker = cards.querySelector('.scroll-end-marker');
        if (marker) {
          marker.remove();
        }
      });
    }
  }
  
  setupScrollIndicators(container) {
    if (!container) return;
    
    const updateIndicators = () => {
      const canScrollLeft = container.scrollLeft > 0;
      const canScrollRight = container.scrollLeft < (container.scrollWidth - container.clientWidth);
      
      container.classList.toggle('can-scroll-left', canScrollLeft);
      container.classList.toggle('can-scroll-right', canScrollRight);
    };
    
    // 初始检查
    updateIndicators();
    
    // 监听滚动事件
    container.addEventListener('scroll', updateIndicators, { passive: true });
    
    // 监听尺寸变化
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(updateIndicators);
      resizeObserver.observe(container);
      
      // 保存观察器引用以便清理
      if (!this.resizeObservers) {
        this.resizeObservers = [];
      }
      this.resizeObservers.push(resizeObserver);
    }
  }
  
  // 公共方法
  getWatchedEpisodes() {
    return Array.from(this.watchedEpisodes);
  }
  
  clearWatchedStatus() {
    this.watchedEpisodes.clear();
    this.saveWatchedStatus();
    
    const cards = this.container.querySelectorAll('.episode-card');
    cards.forEach(card => {
      card.classList.remove('watched');
      const watchStatus = card.querySelector('.watch-status');
      if (watchStatus) {
        watchStatus.classList.remove('watched');
        watchStatus.removeAttribute('title');
      }
    });
    
    this.updateSeasonProgress();
    this.emit('watchedStatusCleared');
  }
  
  destroy() {
    // 清理事件监听器
    window.removeEventListener('resize', this.updateLayout);
    
    // 清理 ResizeObserver
    if (this.resizeObservers) {
      this.resizeObservers.forEach(observer => {
        observer.disconnect();
      });
      this.resizeObservers = [];
    }
    
    this.eventListeners.clear();
    
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// 视频源管理组件
class VideoSourceManager {
  constructor(container, sources, options = {}) {
    this.container = container;
    this.sources = sources || [];
    this.options = {
      showSourceQuality: true,
      showSourceStatus: true,
      ...options
    };
    this.activeSource = 'primary';
    this.eventListeners = new Map();
    
    this.render();
  }
  
  render() {
    if (!this.container) return;
    
    const dropdown = this.container.querySelector('select');
    if (!dropdown) {
      console.warn('VideoSourceManager: No select element found in container');
      return;
    }
    
    // 清空现有选项
    dropdown.innerHTML = '';
    
    // 如果没有源或只有一个源，隐藏选择器
    if (this.sources.length <= 1) {
      this.container.style.display = 'none';
      return;
    }
    
    // 添加选项
    this.sources.forEach(source => {
      const option = document.createElement('option');
      option.value = source.id;
      option.textContent = this.formatSourceName(source);
      
      // 添加数据属性
      if (source.quality) {
        option.dataset.quality = source.quality;
      }
      if (source.status) {
        option.dataset.status = source.status;
      }
      
      dropdown.appendChild(option);
    });
    
    // 设置当前选中的源
    dropdown.value = this.activeSource;
    
    // 显示选择器
    this.container.style.display = 'flex';
    
    this.setupEventListeners();
    this.updateSourceStatus();
  }
  
  formatSourceName(source) {
    let name = source.name;
    
    // 添加质量标识
    if (this.options.showSourceQuality && source.quality) {
      name += ` (${source.quality})`;
    }
    
    // 添加状态标识
    if (this.options.showSourceStatus && source.status) {
      switch (source.status) {
        case 'online':
          name += ' ✓';
          break;
        case 'offline':
          name += ' ✗';
          break;
        case 'slow':
          name += ' ⚠';
          break;
      }
    }
    
    return name;
  }
  
  setupEventListeners() {
    const dropdown = this.container.querySelector('select');
    if (!dropdown) return;
    
    // 移除旧的事件监听器
    dropdown.removeEventListener('change', this.handleSourceChange);
    
    // 添加新的事件监听器
    this.handleSourceChange = (e) => {
      const sourceId = e.target.value;
      const source = this.sources.find(s => s.id === sourceId);
      
      if (source) {
        this.setActiveSource(sourceId);
        this.emit('sourceChange', { 
          sourceId, 
          source,
          previousSource: this.activeSource 
        });
      }
    };
    
    dropdown.addEventListener('change', this.handleSourceChange);
    
    // 键盘导航支持
    dropdown.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dropdown.click();
      }
    });
  }
  
  updateSources(sources) {
    this.sources = sources || [];
    this.render();
    
    this.emit('sourcesUpdated', { sources: this.sources });
  }
  
  setActiveSource(sourceId) {
    const source = this.sources.find(s => s.id === sourceId);
    if (!source) {
      console.warn(`VideoSourceManager: Source with id "${sourceId}" not found`);
      return;
    }
    
    const previousSource = this.activeSource;
    this.activeSource = sourceId;
    
    const dropdown = this.container.querySelector('select');
    if (dropdown) {
      dropdown.value = sourceId;
    }
    
    this.updateSourceStatus();
    
    this.emit('activeSourceChanged', { 
      sourceId, 
      source,
      previousSource 
    });
  }
  
  updateSourceStatus() {
    const dropdown = this.container.querySelector('select');
    if (!dropdown) return;
    
    const activeSource = this.sources.find(s => s.id === this.activeSource);
    if (!activeSource) return;
    
    // 更新容器的状态类
    this.container.classList.remove('source-online', 'source-offline', 'source-slow');
    
    if (activeSource.status) {
      this.container.classList.add(`source-${activeSource.status}`);
    }
    
    // 更新标签文本
    const label = this.container.querySelector('label');
    if (label) {
      let labelText = '视频源：';
      
      if (activeSource.status === 'offline') {
        labelText = '视频源（离线）：';
      } else if (activeSource.status === 'slow') {
        labelText = '视频源（慢速）：';
      }
      
      label.textContent = labelText;
    }
  }
  
  // 源状态检测
  async checkSourceStatus(sourceId) {
    const source = this.sources.find(s => s.id === sourceId);
    if (!source || !source.url) return 'unknown';
    
    try {
      // 简单的连通性检测
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(source.url, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return 'online';
      } else {
        return 'offline';
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        return 'slow';
      }
      return 'offline';
    }
  }
  
  async checkAllSourcesStatus() {
    const statusPromises = this.sources.map(async (source) => {
      const status = await this.checkSourceStatus(source.id);
      return { id: source.id, status };
    });
    
    const results = await Promise.all(statusPromises);
    
    // 更新源状态
    results.forEach(result => {
      const source = this.sources.find(s => s.id === result.id);
      if (source) {
        source.status = result.status;
      }
    });
    
    // 重新渲染以显示状态
    this.render();
    
    this.emit('statusCheckCompleted', { results });
    
    return results;
  }
  
  // 获取推荐的源（优先在线和快速的源）
  getRecommendedSource() {
    // 优先级：在线 > 慢速 > 离线
    const onlineSources = this.sources.filter(s => s.status === 'online');
    if (onlineSources.length > 0) {
      return onlineSources[0];
    }
    
    const slowSources = this.sources.filter(s => s.status === 'slow');
    if (slowSources.length > 0) {
      return slowSources[0];
    }
    
    // 如果都没有状态信息，返回第一个
    return this.sources[0] || null;
  }
  
  // 自动切换到最佳源
  switchToBestSource() {
    const bestSource = this.getRecommendedSource();
    if (bestSource && bestSource.id !== this.activeSource) {
      this.setActiveSource(bestSource.id);
      this.emit('sourceChange', { 
        sourceId: bestSource.id, 
        source: bestSource,
        reason: 'auto-switch'
      });
      return true;
    }
    return false;
  }
  
  // 获取当前活跃源信息
  getActiveSource() {
    return this.sources.find(s => s.id === this.activeSource) || null;
  }
  
  // 获取所有源信息
  getAllSources() {
    return [...this.sources];
  }
  
  // 添加新源
  addSource(source) {
    if (!source.id || !source.name) {
      console.warn('VideoSourceManager: Invalid source object');
      return;
    }
    
    // 检查是否已存在
    const existingIndex = this.sources.findIndex(s => s.id === source.id);
    if (existingIndex >= 0) {
      // 更新现有源
      this.sources[existingIndex] = { ...this.sources[existingIndex], ...source };
    } else {
      // 添加新源
      this.sources.push(source);
    }
    
    this.render();
    this.emit('sourceAdded', { source });
  }
  
  // 移除源
  removeSource(sourceId) {
    const index = this.sources.findIndex(s => s.id === sourceId);
    if (index >= 0) {
      const removedSource = this.sources.splice(index, 1)[0];
      
      // 如果移除的是当前活跃源，切换到第一个可用源
      if (sourceId === this.activeSource && this.sources.length > 0) {
        this.setActiveSource(this.sources[0].id);
      }
      
      this.render();
      this.emit('sourceRemoved', { source: removedSource });
      
      return removedSource;
    }
    return null;
  }
  
  // 事件系统
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }
  
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }
  
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in source manager event listener:`, error);
        }
      });
    }
  }
  
  // 清理资源
  destroy() {
    const dropdown = this.container.querySelector('select');
    if (dropdown && this.handleSourceChange) {
      dropdown.removeEventListener('change', this.handleSourceChange);
    }
    
    this.eventListeners.clear();
    
    if (this.container) {
      this.container.style.display = 'none';
    }
  }
}

// 播放进度管理器
class PlaybackProgressManager {
  constructor(options = {}) {
    this.options = {
      storageKey: 'video_progress',
      autoSaveInterval: 10000, // 10秒自动保存一次
      watchedThreshold: 0.9, // 90% 算作已观看
      skipThreshold: 10, // 跳过前10秒的进度恢复
      ...options
    };
    
    this.currentArticleId = this.getCurrentArticleId();
    this.autoSaveTimer = null;
    this.progressData = this.loadProgressData();
    
    this.startAutoSave();
  }
  
  getCurrentArticleId() {
    // 基于当前页面路径生成文章ID
    return window.location.pathname.replace(/\//g, '_') || 'default';
  }
  
  getStorageKey() {
    return `${this.options.storageKey}_${this.currentArticleId}`;
  }
  
  loadProgressData() {
    try {
      const stored = localStorage.getItem(this.getStorageKey());
      if (stored) {
        const data = JSON.parse(stored);
        // 验证数据结构
        if (data && typeof data === 'object') {
          return {
            currentEpisode: data.currentEpisode || null,
            lastWatched: data.lastWatched || null,
            episodes: data.episodes || {},
            ...data
          };
        }
      }
    } catch (error) {
      console.warn('Failed to load progress data:', error);
    }
    
    return {
      currentEpisode: null,
      lastWatched: null,
      episodes: {}
    };
  }
  
  saveProgressData() {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(this.progressData));
      return true;
    } catch (error) {
      console.warn('Failed to save progress data:', error);
      
      // 如果存储失败，尝试清理旧数据
      this.cleanupOldData();
      
      try {
        localStorage.setItem(this.getStorageKey(), JSON.stringify(this.progressData));
        return true;
      } catch (retryError) {
        console.error('Failed to save progress data after cleanup:', retryError);
        return false;
      }
    }
  }
  
  cleanupOldData() {
    try {
      const keys = Object.keys(localStorage);
      const progressKeys = keys.filter(key => key.startsWith(this.options.storageKey));
      
      // 按时间排序，保留最近的10个
      const keyData = progressKeys.map(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          return {
            key,
            lastWatched: new Date(data.lastWatched || 0).getTime()
          };
        } catch {
          return { key, lastWatched: 0 };
        }
      });
      
      keyData.sort((a, b) => b.lastWatched - a.lastWatched);
      
      // 删除超过10个的旧数据
      keyData.slice(10).forEach(item => {
        localStorage.removeItem(item.key);
      });
      
    } catch (error) {
      console.warn('Failed to cleanup old progress data:', error);
    }
  }
  
  saveEpisodeProgress(episodeId, currentTime, duration) {
    if (!episodeId || currentTime < 0 || duration <= 0) return;
    
    const progressRatio = currentTime / duration;
    const isWatched = progressRatio >= this.options.watchedThreshold;
    
    // 更新集数进度
    this.progressData.episodes[episodeId] = {
      progress: currentTime,
      duration: duration,
      watched: isWatched,
      lastPosition: currentTime,
      lastUpdated: new Date().toISOString(),
      progressRatio: progressRatio
    };
    
    // 更新全局信息
    this.progressData.currentEpisode = episodeId;
    this.progressData.lastWatched = new Date().toISOString();
    
    return this.saveProgressData();
  }
  
  getEpisodeProgress(episodeId) {
    if (!episodeId || !this.progressData.episodes[episodeId]) {
      return null;
    }
    
    return { ...this.progressData.episodes[episodeId] };
  }
  
  getLastWatchedEpisode() {
    return this.progressData.currentEpisode;
  }
  
  shouldResumeProgress(episodeId) {
    const progress = this.getEpisodeProgress(episodeId);
    if (!progress) return false;
    
    // 如果已经观看完成，不恢复进度
    if (progress.watched) return false;
    
    // 如果进度太少（前10秒），不恢复
    if (progress.lastPosition < this.options.skipThreshold) return false;
    
    // 如果进度接近结尾（最后30秒），不恢复
    if (progress.duration - progress.lastPosition < 30) return false;
    
    return true;
  }
  
  getResumePosition(episodeId) {
    const progress = this.getEpisodeProgress(episodeId);
    if (!progress || !this.shouldResumeProgress(episodeId)) {
      return 0;
    }
    
    return progress.lastPosition;
  }
  
  markEpisodeAsWatched(episodeId, duration = null) {
    if (!episodeId) return;
    
    if (!this.progressData.episodes[episodeId]) {
      this.progressData.episodes[episodeId] = {};
    }
    
    this.progressData.episodes[episodeId] = {
      ...this.progressData.episodes[episodeId],
      watched: true,
      lastUpdated: new Date().toISOString()
    };
    
    if (duration) {
      this.progressData.episodes[episodeId].duration = duration;
      this.progressData.episodes[episodeId].progress = duration;
      this.progressData.episodes[episodeId].lastPosition = duration;
      this.progressData.episodes[episodeId].progressRatio = 1;
    }
    
    this.saveProgressData();
  }
  
  isEpisodeWatched(episodeId) {
    const progress = this.getEpisodeProgress(episodeId);
    return progress ? progress.watched : false;
  }
  
  getWatchedEpisodes() {
    return Object.keys(this.progressData.episodes).filter(episodeId => 
      this.progressData.episodes[episodeId].watched
    );
  }
  
  getWatchedCount() {
    return this.getWatchedEpisodes().length;
  }
  
  getTotalWatchTime() {
    let totalTime = 0;
    
    Object.values(this.progressData.episodes).forEach(episode => {
      if (episode.progress && episode.progress > 0) {
        totalTime += episode.progress;
      }
    });
    
    return totalTime;
  }
  
  getWatchingStats() {
    const watchedEpisodes = this.getWatchedEpisodes();
    const totalEpisodes = Object.keys(this.progressData.episodes).length;
    const totalWatchTime = this.getTotalWatchTime();
    
    return {
      watchedCount: watchedEpisodes.length,
      totalCount: totalEpisodes,
      watchedRatio: totalEpisodes > 0 ? watchedEpisodes.length / totalEpisodes : 0,
      totalWatchTime: totalWatchTime,
      formattedWatchTime: this.formatTime(totalWatchTime)
    };
  }
  
  formatTime(seconds) {
    if (!seconds || seconds < 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }
  
  clearProgress(episodeId = null) {
    if (episodeId) {
      // 清除特定集数的进度
      delete this.progressData.episodes[episodeId];
      
      // 如果清除的是当前集数，重置当前集数
      if (this.progressData.currentEpisode === episodeId) {
        this.progressData.currentEpisode = null;
      }
    } else {
      // 清除所有进度
      this.progressData = {
        currentEpisode: null,
        lastWatched: null,
        episodes: {}
      };
    }
    
    this.saveProgressData();
  }
  
  clearAllProgress() {
    this.clearProgress();
  }
  
  exportProgress() {
    return {
      ...this.progressData,
      exportedAt: new Date().toISOString(),
      articleId: this.currentArticleId
    };
  }
  
  importProgress(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid progress data');
    }
    
    // 验证数据结构
    const validData = {
      currentEpisode: data.currentEpisode || null,
      lastWatched: data.lastWatched || null,
      episodes: data.episodes || {}
    };
    
    this.progressData = validData;
    return this.saveProgressData();
  }
  
  startAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setInterval(() => {
      // 定期保存数据（防止数据丢失）
      this.saveProgressData();
    }, this.options.autoSaveInterval);
  }
  
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }
  
  // 获取进度恢复提示信息
  getResumePrompt(episodeId) {
    const progress = this.getEpisodeProgress(episodeId);
    if (!progress || !this.shouldResumeProgress(episodeId)) {
      return null;
    }
    
    const timeStr = this.formatTime(progress.lastPosition);
    const progressPercent = Math.round(progress.progressRatio * 100);
    
    return {
      message: `继续观看？上次播放到 ${timeStr} (${progressPercent}%)`,
      position: progress.lastPosition,
      progressPercent: progressPercent
    };
  }
  
  // 事件监听器管理
  onProgressUpdate(callback) {
    this.progressUpdateCallback = callback;
  }
  
  onWatchedStatusChange(callback) {
    this.watchedStatusCallback = callback;
  }
  
  // 触发事件
  triggerProgressUpdate(episodeId, progress) {
    if (this.progressUpdateCallback) {
      this.progressUpdateCallback({ episodeId, progress });
    }
  }
  
  triggerWatchedStatusChange(episodeId, watched) {
    if (this.watchedStatusCallback) {
      this.watchedStatusCallback({ episodeId, watched });
    }
  }
  
  // 清理资源
  destroy() {
    this.stopAutoSave();
    
    // 最后保存一次
    this.saveProgressData();
    
    this.progressUpdateCallback = null;
    this.watchedStatusCallback = null;
  }
}

// 视频兼容性处理器
class VideoCompatibilityHandler {
  constructor(options = {}) {
    this.options = {
      enableAutoMigration: true,
      preserveOldFormat: true,
      logMigrations: true,
      ...options
    };
    
    this.migrationLog = [];
  }
  
  // 检测视频数据格式版本
  detectDataFormat(videoData) {
    if (!videoData || typeof videoData !== 'object') {
      return 'invalid';
    }
    
    // 新格式检测
    if (videoData.type && (videoData.type === 'movie' || videoData.type === 'series')) {
      if (videoData.type === 'series' && videoData.seasons && Array.isArray(videoData.seasons)) {
        return 'v2_multi_season'; // 新格式：多季支持
      }
      return 'v2_single'; // 新格式：单季或电影
    }
    
    // 旧格式检测
    if (videoData.url || (videoData.episodes && Array.isArray(videoData.episodes))) {
      return 'v1_legacy'; // 旧格式
    }
    
    // iframe 嵌入格式检测
    if (typeof videoData === 'string' && videoData.includes('<iframe')) {
      return 'iframe_embed';
    }
    
    return 'unknown';
  }
  
  // 迁移旧格式数据到新格式
  migrateToNewFormat(videoData, contentType = 'auto') {
    const format = this.detectDataFormat(videoData);
    
    if (format === 'v2_multi_season' || format === 'v2_single') {
      // 已经是新格式，直接返回
      return videoData;
    }
    
    let migratedData = null;
    
    switch (format) {
      case 'v1_legacy':
        migratedData = this.migrateLegacyFormat(videoData, contentType);
        break;
      case 'iframe_embed':
        migratedData = this.migrateIframeEmbed(videoData, contentType);
        break;
      default:
        console.warn('VideoCompatibilityHandler: Unknown format, cannot migrate');
        return null;
    }
    
    if (migratedData && this.options.logMigrations) {
      this.logMigration(format, 'v2_single', videoData, migratedData);
    }
    
    return migratedData;
  }
  
  // 迁移旧版本格式
  migrateLegacyFormat(data, contentType) {
    // 检测内容类型
    if (contentType === 'auto') {
      contentType = this.detectContentType(data);
    }
    
    if (contentType === 'movie' || (data.url && !data.episodes)) {
      // 电影格式
      return {
        type: 'movie',
        label: data.label || '电影',
        name: data.name || '主源',
        url: data.url,
        alternatives: data.alternatives || []
      };
    } else if (data.episodes && Array.isArray(data.episodes)) {
      // 电视剧格式
      return {
        type: 'series',
        label: data.label || '连续剧',
        seasons: [{
          season_number: 1,
          season_title: data.label || '第一季',
          episodes: data.episodes.map((episode, index) => ({
            number: episode.number || `第${index + 1}集`,
            title: episode.title || '',
            name: episode.name || '主源',
            url: episode.url,
            alternatives: episode.alternatives || []
          }))
        }]
      };
    }
    
    return null;
  }
  
  // 迁移 iframe 嵌入格式
  migrateIframeEmbed(iframeHtml, contentType) {
    // 从 iframe 中提取 URL
    const srcMatch = iframeHtml.match(/src=["']([^"']+)["']/);
    if (!srcMatch) {
      console.warn('VideoCompatibilityHandler: Cannot extract URL from iframe');
      return null;
    }
    
    const url = srcMatch[1];
    
    // 尝试从 URL 中提取实际视频地址
    const videoUrl = this.extractVideoUrlFromPlayerUrl(url);
    
    return {
      type: contentType === 'series' ? 'series' : 'movie',
      label: contentType === 'series' ? '连续剧' : '电影',
      name: '主源',
      url: videoUrl || url,
      alternatives: []
    };
  }
  
  // 从播放器 URL 中提取视频地址
  extractVideoUrlFromPlayerUrl(playerUrl) {
    try {
      const url = new URL(playerUrl, window.location.origin);
      const videoParam = url.searchParams.get('url') || url.searchParams.get('v') || url.searchParams.get('src');
      
      if (videoParam) {
        return decodeURIComponent(videoParam);
      }
    } catch (error) {
      console.warn('VideoCompatibilityHandler: Failed to parse player URL:', error);
    }
    
    return null;
  }
  
  // 检测内容类型
  detectContentType(data) {
    // 基于数据结构推断内容类型
    if (data.episodes && Array.isArray(data.episodes) && data.episodes.length > 1) {
      return 'series';
    }
    
    if (data.url && !data.episodes) {
      return 'movie';
    }
    
    // 基于标签推断
    if (data.label) {
      const label = data.label.toLowerCase();
      if (label.includes('季') || label.includes('集') || label.includes('剧')) {
        return 'series';
      }
      if (label.includes('电影') || label.includes('影片')) {
        return 'movie';
      }
    }
    
    return 'movie'; // 默认为电影
  }
  
  // 验证迁移后的数据
  validateMigratedData(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['Data is not an object'] };
    }
    
    const errors = [];
    
    // 检查必需字段
    if (!data.type || !['movie', 'series'].includes(data.type)) {
      errors.push('Invalid or missing type field');
    }
    
    if (!data.label || typeof data.label !== 'string') {
      errors.push('Invalid or missing label field');
    }
    
    if (data.type === 'movie') {
      if (!data.url || typeof data.url !== 'string') {
        errors.push('Movie type requires valid URL');
      }
    } else if (data.type === 'series') {
      if (!data.seasons || !Array.isArray(data.seasons) || data.seasons.length === 0) {
        errors.push('Series type requires seasons array');
      } else {
        data.seasons.forEach((season, seasonIndex) => {
          if (!season.episodes || !Array.isArray(season.episodes)) {
            errors.push(`Season ${seasonIndex + 1} missing episodes array`);
          } else {
            season.episodes.forEach((episode, episodeIndex) => {
              if (!episode.url || typeof episode.url !== 'string') {
                errors.push(`Season ${seasonIndex + 1}, Episode ${episodeIndex + 1} missing URL`);
              }
            });
          }
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
  
  // 创建兼容性包装器
  createCompatibilityWrapper(originalData, migratedData) {
    return {
      // 新格式数据
      current: migratedData,
      
      // 保留原始数据（如果需要）
      legacy: this.options.preserveOldFormat ? originalData : null,
      
      // 元数据
      metadata: {
        originalFormat: this.detectDataFormat(originalData),
        migrationDate: new Date().toISOString(),
        version: '2.0'
      },
      
      // 兼容性方法
      getLegacyFormat: () => originalData,
      getCurrentFormat: () => migratedData,
      isMigrated: () => true
    };
  }
  
  // 批量迁移数据
  batchMigrate(dataArray, contentTypes = []) {
    if (!Array.isArray(dataArray)) {
      return [];
    }
    
    return dataArray.map((data, index) => {
      const contentType = contentTypes[index] || 'auto';
      const migrated = this.migrateToNewFormat(data, contentType);
      
      if (migrated) {
        const validation = this.validateMigratedData(migrated);
        if (validation.valid) {
          return this.createCompatibilityWrapper(data, migrated);
        } else {
          console.warn(`VideoCompatibilityHandler: Migration validation failed for item ${index}:`, validation.errors);
          return null;
        }
      }
      
      return null;
    }).filter(item => item !== null);
  }
  
  // 记录迁移日志
  logMigration(fromFormat, toFormat, originalData, migratedData) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      fromFormat,
      toFormat,
      originalDataSize: JSON.stringify(originalData).length,
      migratedDataSize: JSON.stringify(migratedData).length,
      success: true
    };
    
    this.migrationLog.push(logEntry);
    
    if (this.options.logMigrations) {
      console.log('VideoCompatibilityHandler: Migration completed', logEntry);
    }
  }
  
  // 获取迁移统计
  getMigrationStats() {
    const stats = {
      totalMigrations: this.migrationLog.length,
      successfulMigrations: this.migrationLog.filter(log => log.success).length,
      formatBreakdown: {},
      averageDataSizeChange: 0
    };
    
    this.migrationLog.forEach(log => {
      const key = `${log.fromFormat} -> ${log.toFormat}`;
      stats.formatBreakdown[key] = (stats.formatBreakdown[key] || 0) + 1;
    });
    
    if (this.migrationLog.length > 0) {
      const totalSizeChange = this.migrationLog.reduce((sum, log) => {
        return sum + (log.migratedDataSize - log.originalDataSize);
      }, 0);
      stats.averageDataSizeChange = totalSizeChange / this.migrationLog.length;
    }
    
    return stats;
  }
  
  // 清理迁移日志
  clearMigrationLog() {
    this.migrationLog = [];
  }
  
  // 检查是否需要迁移
  needsMigration(data) {
    const format = this.detectDataFormat(data);
    return format !== 'v2_multi_season' && format !== 'v2_single' && format !== 'invalid';
  }
  
  // 获取兼容性报告
  getCompatibilityReport(data) {
    const format = this.detectDataFormat(data);
    const needsMigration = this.needsMigration(data);
    
    let recommendations = [];
    let warnings = [];
    
    if (needsMigration) {
      recommendations.push('建议迁移到新格式以获得更好的功能支持');
    }
    
    if (format === 'iframe_embed') {
      warnings.push('iframe 嵌入格式可能在某些设备上性能较差');
    }
    
    if (format === 'v1_legacy') {
      warnings.push('旧格式不支持多季电视剧和高级功能');
    }
    
    return {
      currentFormat: format,
      needsMigration,
      canMigrate: format !== 'invalid' && format !== 'unknown',
      recommendations,
      warnings,
      supportedFeatures: this.getSupportedFeatures(format)
    };
  }
  
  // 获取格式支持的功能
  getSupportedFeatures(format) {
    const features = {
      singleVideo: false,
      multipleEpisodes: false,
      multipleSeasons: false,
      alternativeSources: false,
      progressTracking: false,
      customLabels: false,
      episodeNavigation: false
    };
    
    switch (format) {
      case 'v2_multi_season':
        Object.keys(features).forEach(key => features[key] = true);
        break;
      case 'v2_single':
        features.singleVideo = true;
        features.multipleEpisodes = true;
        features.alternativeSources = true;
        features.progressTracking = true;
        features.customLabels = true;
        features.episodeNavigation = true;
        break;
      case 'v1_legacy':
        features.singleVideo = true;
        features.multipleEpisodes = true;
        features.alternativeSources = true;
        break;
      case 'iframe_embed':
        features.singleVideo = true;
        break;
    }
    
    return features;
  }
}

// 集数懒加载组件
class EpisodeLazyLoader {
  constructor(options = {}) {
    this.options = {
      threshold: 0.1,
      rootMargin: '50px',
      loadBatchSize: 5,
      enablePreloading: true,
      ...options
    };
    
    this.observer = null;
    this.loadedEpisodes = new Set();
    this.loadingQueue = [];
    this.isLoading = false;
    
    this.initializeObserver();
  }
  
  initializeObserver() {
    if (!window.IntersectionObserver) {
      console.warn('EpisodeLazyLoader: IntersectionObserver not supported');
      return;
    }
    
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadEpisode(entry.target);
        }
      });
    }, {
      threshold: this.options.threshold,
      rootMargin: this.options.rootMargin
    });
  }
  
  // 观察集数卡片
  observe(episodeCard) {
    if (this.observer && episodeCard) {
      this.observer.observe(episodeCard);
    }
  }
  
  // 停止观察
  unobserve(episodeCard) {
    if (this.observer && episodeCard) {
      this.observer.unobserve(episodeCard);
    }
  }
  
  // 加载集数数据
  async loadEpisode(episodeCard) {
    const episodeId = episodeCard.dataset.episode;
    if (!episodeId || this.loadedEpisodes.has(episodeId)) {
      return;
    }
    
    // 添加到加载队列
    this.loadingQueue.push({ episodeId, element: episodeCard });
    
    // 处理加载队列
    if (!this.isLoading) {
      this.processLoadingQueue();
    }
  }
  
  // 处理加载队列
  async processLoadingQueue() {
    if (this.isLoading || this.loadingQueue.length === 0) {
      return;
    }
    
    this.isLoading = true;
    
    while (this.loadingQueue.length > 0) {
      const batch = this.loadingQueue.splice(0, this.options.loadBatchSize);
      
      await Promise.all(batch.map(item => this.loadEpisodeData(item)));
      
      // 小延迟避免阻塞 UI
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    this.isLoading = false;
  }
  
  // 加载单个集数数据
  async loadEpisodeData({ episodeId, element }) {
    try {
      // 标记为已加载
      this.loadedEpisodes.add(episodeId);
      
      // 停止观察该元素
      this.unobserve(element);
      
      // 添加加载完成的样式
      element.classList.add('lazy-loaded');
      
      // 如果启用预加载，预加载视频元数据
      if (this.options.enablePreloading) {
        this.preloadEpisodeMetadata(episodeId, element);
      }
      
    } catch (error) {
      console.warn(`EpisodeLazyLoader: Failed to load episode ${episodeId}:`, error);
    }
  }
  
  // 预加载集数元数据
  async preloadEpisodeMetadata(episodeId, element) {
    try {
      const videoUrl = element.dataset.videoUrl;
      if (!videoUrl) return;
      
      // 创建隐藏的视频元素来预加载元数据
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.style.display = 'none';
      video.muted = true;
      
      video.addEventListener('loadedmetadata', () => {
        // 存储元数据
        element.dataset.duration = video.duration;
        element.dataset.videoWidth = video.videoWidth;
        element.dataset.videoHeight = video.videoHeight;
        
        // 清理
        document.body.removeChild(video);
      });
      
      video.addEventListener('error', () => {
        // 清理
        if (video.parentNode) {
          document.body.removeChild(video);
        }
      });
      
      document.body.appendChild(video);
      video.src = videoUrl;
      
    } catch (error) {
      console.warn(`EpisodeLazyLoader: Failed to preload metadata for ${episodeId}:`, error);
    }
  }
  
  // 销毁
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    this.loadedEpisodes.clear();
    this.loadingQueue = [];
  }
}

// 视频预加载器
class VideoPreloader {
  constructor(options = {}) {
    this.options = {
      maxConcurrentPreloads: 2,
      preloadNextEpisodes: 1,
      preloadAlternativeSources: false,
      enableSmartPreloading: true,
      ...options
    };
    
    this.preloadCache = new Map();
    this.preloadQueue = [];
    this.activePreloads = new Set();
  }
  
  // 预加载下一集
  preloadNextEpisodes(currentEpisodeId, episodes) {
    if (!this.options.enableSmartPreloading) return;
    
    const currentIndex = episodes.findIndex(ep => ep.id === currentEpisodeId);
    if (currentIndex === -1) return;
    
    // 预加载接下来的几集
    for (let i = 1; i <= this.options.preloadNextEpisodes; i++) {
      const nextIndex = currentIndex + i;
      if (nextIndex < episodes.length) {
        const nextEpisode = episodes[nextIndex];
        this.queuePreload(nextEpisode.id, nextEpisode.url, 'next_episode');
      }
    }
  }
  
  // 队列预加载
  queuePreload(episodeId, url, priority = 'normal') {
    if (this.preloadCache.has(episodeId) || this.isPreloading(episodeId)) {
      return;
    }
    
    this.preloadQueue.push({
      episodeId,
      url,
      priority,
      timestamp: Date.now()
    });
    
    // 按优先级排序
    this.preloadQueue.sort((a, b) => {
      const priorityOrder = { 'high': 3, 'next_episode': 2, 'normal': 1, 'low': 0 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    
    this.processPreloadQueue();
  }
  
  // 处理预加载队列
  async processPreloadQueue() {
    while (this.preloadQueue.length > 0 && this.activePreloads.size < this.options.maxConcurrentPreloads) {
      const item = this.preloadQueue.shift();
      this.startPreload(item);
    }
  }
  
  // 开始预加载
  async startPreload({ episodeId, url, priority }) {
    if (this.activePreloads.has(episodeId)) return;
    
    this.activePreloads.add(episodeId);
    
    try {
      const preloadData = await this.preloadVideo(url);
      
      this.preloadCache.set(episodeId, {
        url,
        data: preloadData,
        timestamp: Date.now(),
        priority
      });
      
      console.log(`VideoPreloader: Successfully preloaded ${episodeId}`);
      
    } catch (error) {
      console.warn(`VideoPreloader: Failed to preload ${episodeId}:`, error);
    } finally {
      this.activePreloads.delete(episodeId);
      
      // 继续处理队列
      this.processPreloadQueue();
    }
  }
  
  // 预加载视频
  async preloadVideo(url) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.style.display = 'none';
      video.muted = true;
      
      const cleanup = () => {
        if (video.parentNode) {
          document.body.removeChild(video);
        }
      };
      
      video.addEventListener('canplaythrough', () => {
        resolve({
          duration: video.duration,
          buffered: video.buffered.length > 0 ? video.buffered.end(0) : 0,
          readyState: video.readyState
        });
        cleanup();
      });
      
      video.addEventListener('error', (error) => {
        reject(error);
        cleanup();
      });
      
      // 超时处理
      setTimeout(() => {
        if (video.readyState < 3) { // HAVE_FUTURE_DATA
          reject(new Error('Preload timeout'));
          cleanup();
        }
      }, 30000);
      
      document.body.appendChild(video);
      video.src = url;
    });
  }
  
  // 检查是否正在预加载
  isPreloading(episodeId) {
    return this.activePreloads.has(episodeId);
  }
  
  // 获取预加载数据
  getPreloadData(episodeId) {
    return this.preloadCache.get(episodeId);
  }
  
  // 清理过期的预加载数据
  cleanupExpiredPreloads(maxAge = 300000) { // 5分钟
    const now = Date.now();
    
    for (const [episodeId, data] of this.preloadCache.entries()) {
      if (now - data.timestamp > maxAge) {
        this.preloadCache.delete(episodeId);
      }
    }
  }
  
  // 获取缓存统计
  getCacheStats() {
    return {
      cacheSize: this.preloadCache.size,
      activePreloads: this.activePreloads.size,
      queueLength: this.preloadQueue.length,
      cacheEntries: Array.from(this.preloadCache.keys())
    };
  }
  
  // 清理所有预加载
  clearAll() {
    this.preloadCache.clear();
    this.preloadQueue = [];
    this.activePreloads.clear();
  }
  
  // 销毁
  destroy() {
    this.clearAll();
  }
}

// 网络监控器
class NetworkMonitor {
  constructor(options = {}) {
    this.options = {
      checkInterval: 30000, // 30秒检查一次
      timeoutThreshold: 10000, // 10秒超时
      enableConnectionAPI: true,
      enableSpeedTest: false,
      speedTestInterval: 300000, // 5分钟测速一次
      ...options
    };
    
    this.isOnline = navigator.onLine;
    this.connectionInfo = null;
    this.networkSpeed = null;
    this.eventListeners = new Map();
    this.checkTimer = null;
    this.speedTestTimer = null;
    
    this.initialize();
  }
  
  initialize() {
    // 监听在线/离线事件
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // 监听连接变化（如果支持）
    if (this.options.enableConnectionAPI && 'connection' in navigator) {
      this.connectionInfo = navigator.connection;
      this.connectionInfo.addEventListener('change', this.handleConnectionChange.bind(this));
    }
    
    // 开始定期检查
    this.startPeriodicCheck();
    
    // 开始速度测试（如果启用）
    if (this.options.enableSpeedTest) {
      this.startSpeedTest();
    }
    
    // 初始状态检查
    this.checkNetworkStatus();
  }
  
  // 处理在线事件
  handleOnline() {
    console.log('NetworkMonitor: Network online');
    this.isOnline = true;
    this.emit('online', { timestamp: Date.now() });
    this.emit('statusChange', { online: true, timestamp: Date.now() });
  }
  
  // 处理离线事件
  handleOffline() {
    console.log('NetworkMonitor: Network offline');
    this.isOnline = false;
    this.emit('offline', { timestamp: Date.now() });
    this.emit('statusChange', { online: false, timestamp: Date.now() });
  }
  
  // 处理连接变化
  handleConnectionChange() {
    if (!this.connectionInfo) return;
    
    const connectionData = {
      effectiveType: this.connectionInfo.effectiveType,
      downlink: this.connectionInfo.downlink,
      rtt: this.connectionInfo.rtt,
      saveData: this.connectionInfo.saveData,
      timestamp: Date.now()
    };
    
    console.log('NetworkMonitor: Connection changed', connectionData);
    this.emit('connectionChange', connectionData);
    
    // 根据连接质量调整播放策略
    this.adaptToConnectionQuality(connectionData);
  }
  
  // 根据连接质量调整策略
  adaptToConnectionQuality(connectionData) {
    const recommendations = {
      quality: 'auto',
      preload: true,
      bufferSize: 'normal'
    };
    
    switch (connectionData.effectiveType) {
      case 'slow-2g':
      case '2g':
        recommendations.quality = '360p';
        recommendations.preload = false;
        recommendations.bufferSize = 'small';
        break;
      case '3g':
        recommendations.quality = '480p';
        recommendations.preload = false;
        recommendations.bufferSize = 'small';
        break;
      case '4g':
        recommendations.quality = '720p';
        recommendations.preload = true;
        recommendations.bufferSize = 'normal';
        break;
      default:
        recommendations.quality = 'auto';
        recommendations.preload = true;
        recommendations.bufferSize = 'large';
    }
    
    // 如果启用了省流量模式
    if (connectionData.saveData) {
      recommendations.quality = '360p';
      recommendations.preload = false;
      recommendations.bufferSize = 'small';
    }
    
    this.emit('qualityRecommendation', recommendations);
  }
  
  // 开始定期检查
  startPeriodicCheck() {
    this.checkTimer = setInterval(() => {
      this.checkNetworkStatus();
    }, this.options.checkInterval);
  }
  
  // 停止定期检查
  stopPeriodicCheck() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }
  
  // 检查网络状态
  async checkNetworkStatus() {
    try {
      const startTime = Date.now();
      
      // 尝试获取一个小文件来测试连接
      const response = await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(this.options.timeoutThreshold)
      });
      
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      const statusData = {
        online: response.ok,
        latency: latency,
        timestamp: Date.now()
      };
      
      if (this.isOnline !== statusData.online) {
        this.isOnline = statusData.online;
        this.emit('statusChange', statusData);
        
        if (statusData.online) {
          this.emit('online', statusData);
        } else {
          this.emit('offline', statusData);
        }
      }
      
      this.emit('statusCheck', statusData);
      
    } catch (error) {
      const statusData = {
        online: false,
        error: error.message,
        timestamp: Date.now()
      };
      
      if (this.isOnline) {
        this.isOnline = false;
        this.emit('statusChange', statusData);
        this.emit('offline', statusData);
      }
    }
  }
  
  // 开始速度测试
  startSpeedTest() {
    this.speedTestTimer = setInterval(() => {
      this.measureNetworkSpeed();
    }, this.options.speedTestInterval);
    
    // 立即执行一次
    this.measureNetworkSpeed();
  }
  
  // 停止速度测试
  stopSpeedTest() {
    if (this.speedTestTimer) {
      clearInterval(this.speedTestTimer);
      this.speedTestTimer = null;
    }
  }
  
  // 测量网络速度
  async measureNetworkSpeed() {
    try {
      // 使用一个小图片文件进行速度测试
      const testUrl = '/favicon.ico?' + Date.now(); // 避免缓存
      const startTime = Date.now();
      
      const response = await fetch(testUrl, {
        cache: 'no-cache'
      });
      
      if (!response.ok) throw new Error('Speed test request failed');
      
      const data = await response.blob();
      const endTime = Date.now();
      
      const duration = (endTime - startTime) / 1000; // 秒
      const sizeBytes = data.size;
      const speedBps = sizeBytes / duration; // 字节/秒
      const speedKbps = (speedBps * 8) / 1024; // Kbps
      
      this.networkSpeed = {
        downloadSpeed: speedKbps,
        latency: duration * 1000,
        timestamp: Date.now()
      };
      
      this.emit('speedTest', this.networkSpeed);
      
    } catch (error) {
      console.warn('NetworkMonitor: Speed test failed:', error);
      this.emit('speedTestError', { error: error.message, timestamp: Date.now() });
    }
  }
  
  // 获取当前网络状态
  getNetworkStatus() {
    const status = {
      online: this.isOnline,
      timestamp: Date.now()
    };
    
    if (this.connectionInfo) {
      status.connection = {
        effectiveType: this.connectionInfo.effectiveType,
        downlink: this.connectionInfo.downlink,
        rtt: this.connectionInfo.rtt,
        saveData: this.connectionInfo.saveData
      };
    }
    
    if (this.networkSpeed) {
      status.speed = this.networkSpeed;
    }
    
    return status;
  }
  
  // 获取连接质量评级
  getConnectionQuality() {
    if (!this.isOnline) return 'offline';
    
    if (this.connectionInfo) {
      switch (this.connectionInfo.effectiveType) {
        case 'slow-2g':
          return 'very-poor';
        case '2g':
          return 'poor';
        case '3g':
          return 'fair';
        case '4g':
          return 'good';
        default:
          return 'excellent';
      }
    }
    
    // 基于速度测试结果评估
    if (this.networkSpeed) {
      const speed = this.networkSpeed.downloadSpeed;
      if (speed < 100) return 'poor';
      if (speed < 500) return 'fair';
      if (speed < 2000) return 'good';
      return 'excellent';
    }
    
    return 'unknown';
  }
  
  // 检查是否适合高质量播放
  isHighQualityRecommended() {
    const quality = this.getConnectionQuality();
    return ['good', 'excellent'].includes(quality);
  }
  
  // 检查是否应该启用预加载
  isPreloadRecommended() {
    const quality = this.getConnectionQuality();
    const saveData = this.connectionInfo?.saveData;
    
    return !saveData && ['fair', 'good', 'excellent'].includes(quality);
  }
  
  // 获取推荐的缓冲区大小
  getRecommendedBufferSize() {
    const quality = this.getConnectionQuality();
    
    switch (quality) {
      case 'very-poor':
      case 'poor':
        return 'small';
      case 'fair':
        return 'medium';
      case 'good':
      case 'excellent':
        return 'large';
      default:
        return 'medium';
    }
  }
  
  // 事件系统
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }
  
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }
  
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`NetworkMonitor: Error in event listener for "${event}":`, error);
        }
      });
    }
  }
  
  // 销毁
  destroy() {
    // 清理事件监听器
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    if (this.connectionInfo && this.connectionInfo.removeEventListener) {
      this.connectionInfo.removeEventListener('change', this.handleConnectionChange);
    }
    
    // 停止定时器
    this.stopPeriodicCheck();
    this.stopSpeedTest();
    
    // 清理事件监听器
    this.eventListeners.clear();
  }
}

// 视频缓存管理器
class VideoCache {
  constructor(options = {}) {
    this.options = {
      maxCacheSize: 100 * 1024 * 1024, // 100MB
      maxCacheEntries: 50,
      enablePersistentCache: true,
      cacheKeyPrefix: 'video_cache_',
      ...options
    };
    
    this.memoryCache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
    
    this.initializePersistentCache();
  }
  
  // 初始化持久化缓存
  initializePersistentCache() {
    if (!this.options.enablePersistentCache || !window.indexedDB) {
      return;
    }
    
    // 这里可以实现 IndexedDB 缓存
    // 为了简化，暂时只使用内存缓存
  }
  
  // 缓存视频数据
  set(key, data, metadata = {}) {
    const cacheEntry = {
      data,
      metadata: {
        timestamp: Date.now(),
        size: this.estimateSize(data),
        accessCount: 0,
        ...metadata
      }
    };
    
    // 检查缓存大小限制
    this.enforceCache Limits();
    
    this.memoryCache.set(key, cacheEntry);
  }
  
  // 获取缓存数据
  get(key) {
    const entry = this.memoryCache.get(key);
    
    if (entry) {
      entry.metadata.accessCount++;
      entry.metadata.lastAccess = Date.now();
      this.cacheStats.hits++;
      return entry.data;
    } else {
      this.cacheStats.misses++;
      return null;
    }
  }
  
  // 检查是否存在
  has(key) {
    return this.memoryCache.has(key);
  }
  
  // 删除缓存项
  delete(key) {
    return this.memoryCache.delete(key);
  }
  
  // 强制执行缓存限制
  enforceCacheLimits() {
    // 检查条目数量限制
    if (this.memoryCache.size >= this.options.maxCacheEntries) {
      this.evictLeastRecentlyUsed();
    }
    
    // 检查缓存大小限制
    const totalSize = this.getTotalCacheSize();
    if (totalSize > this.options.maxCacheSize) {
      this.evictBySize();
    }
  }
  
  // 驱逐最少使用的项
  evictLeastRecentlyUsed() {
    let oldestEntry = null;
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.memoryCache.entries()) {
      const lastAccess = entry.metadata.lastAccess || entry.metadata.timestamp;
      if (lastAccess < oldestTime) {
        oldestTime = lastAccess;
        oldestEntry = entry;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.cacheStats.evictions++;
    }
  }
  
  // 按大小驱逐
  evictBySize() {
    // 按访问频率和大小排序，优先驱逐大且少用的项
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => {
      const scoreA = a[1].metadata.accessCount / a[1].metadata.size;
      const scoreB = b[1].metadata.accessCount / b[1].metadata.size;
      return scoreA - scoreB; // 分数低的先驱逐
    });
    
    // 驱逐前25%的项
    const evictCount = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < evictCount; i++) {
      this.memoryCache.delete(entries[i][0]);
      this.cacheStats.evictions++;
    }
  }
  
  // 估算数据大小
  estimateSize(data) {
    if (typeof data === 'string') {
      return data.length * 2; // Unicode 字符
    } else if (data instanceof ArrayBuffer) {
      return data.byteLength;
    } else if (data instanceof Blob) {
      return data.size;
    } else {
      return JSON.stringify(data).length * 2;
    }
  }
  
  // 获取总缓存大小
  getTotalCacheSize() {
    let totalSize = 0;
    for (const entry of this.memoryCache.values()) {
      totalSize += entry.metadata.size;
    }
    return totalSize;
  }
  
  // 获取缓存统计
  getStats() {
    return {
      ...this.cacheStats,
      totalEntries: this.memoryCache.size,
      totalSize: this.getTotalCacheSize(),
      hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0
    };
  }
  
  // 清理过期缓存
  cleanupExpired(maxAge = 3600000) { // 1小时
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.metadata.timestamp > maxAge) {
        this.memoryCache.delete(key);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }
  
  // 清空缓存
  clear() {
    this.memoryCache.clear();
    this.cacheStats = { hits: 0, misses: 0, evictions: 0 };
  }
  
  // 销毁
  destroy() {
    this.clear();
  }
}

// 视频错误处理器
class VideoErrorHandler {
  constructor(options = {}) {
    this.options = {
      maxRetries: 3,
      retryDelay: 2000,
      enableAutoRecovery: true,
      logErrors: true,
      showUserFriendlyMessages: true,
      ...options
    };
    
    this.errorLog = [];
    this.retryCount = new Map();
    this.recoveryStrategies = new Map();
    
    this.setupDefaultStrategies();
  }
  
  // 设置默认恢复策略
  setupDefaultStrategies() {
    // 网络错误恢复策略
    this.recoveryStrategies.set('network', [
      { name: 'retry', delay: 1000 },
      { name: 'switch_source', delay: 500 },
      { name: 'reload_player', delay: 2000 }
    ]);
    
    // 媒体错误恢复策略
    this.recoveryStrategies.set('media', [
      { name: 'switch_source', delay: 500 },
      { name: 'reload_player', delay: 1000 },
      { name: 'fallback_iframe', delay: 0 }
    ]);
    
    // 播放器错误恢复策略
    this.recoveryStrategies.set('player', [
      { name: 'reload_player', delay: 1000 },
      { name: 'fallback_iframe', delay: 0 }
    ]);
    
    // 源错误恢复策略
    this.recoveryStrategies.set('source', [
      { name: 'switch_source', delay: 0 },
      { name: 'retry', delay: 2000 }
    ]);
  }
  
  // 处理错误
  async handleError(error, context = {}) {
    const errorInfo = this.analyzeError(error, context);
    
    // 记录错误
    this.logError(errorInfo);
    
    // 检查是否应该尝试恢复
    if (this.shouldAttemptRecovery(errorInfo)) {
      const recovered = await this.attemptRecovery(errorInfo);
      if (recovered) {
        return { recovered: true, strategy: recovered.strategy };
      }
    }
    
    // 恢复失败，显示用户友好的错误消息
    if (this.options.showUserFriendlyMessages) {
      this.showUserError(errorInfo);
    }
    
    return { recovered: false, error: errorInfo };
  }
  
  // 分析错误
  analyzeError(error, context) {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      type: 'unknown',
      category: 'unknown',
      message: error.message || String(error),
      code: error.code || null,
      fatal: false,
      context: context,
      originalError: error
    };
    
    // 分析错误类型
    if (error.name === 'NetworkError' || error.message.includes('network')) {
      errorInfo.type = 'network';
      errorInfo.category = 'network';
      errorInfo.fatal = false;
    } else if (error.name === 'MediaError' || error.code >= 1 && error.code <= 4) {
      errorInfo.type = 'media';
      errorInfo.category = 'media';
      errorInfo.fatal = error.code === 4; // MEDIA_ERR_SRC_NOT_SUPPORTED
    } else if (error.message.includes('ArtPlayer') || error.message.includes('player')) {
      errorInfo.type = 'player';
      errorInfo.category = 'player';
      errorInfo.fatal = true;
    } else if (error.message.includes('source') || error.message.includes('url')) {
      errorInfo.type = 'source';
      errorInfo.category = 'source';
      errorInfo.fatal = false;
    } else if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      errorInfo.type = 'javascript';
      errorInfo.category = 'player';
      errorInfo.fatal = true;
    }
    
    // 分析 HLS 特定错误
    if (error.type && error.details) {
      errorInfo.hlsError = {
        type: error.type,
        details: error.details,
        fatal: error.fatal
      };
      
      if (error.type === 'networkError') {
        errorInfo.category = 'network';
        errorInfo.fatal = false;
      } else if (error.type === 'mediaError') {
        errorInfo.category = 'media';
        errorInfo.fatal = error.fatal;
      }
    }
    
    return errorInfo;
  }
  
  // 检查是否应该尝试恢复
  shouldAttemptRecovery(errorInfo) {
    if (!this.options.enableAutoRecovery) return false;
    if (errorInfo.fatal && errorInfo.category === 'player') return false;
    
    const retryKey = `${errorInfo.category}_${errorInfo.context.episodeId || 'unknown'}`;
    const currentRetries = this.retryCount.get(retryKey) || 0;
    
    return currentRetries < this.options.maxRetries;
  }
  
  // 尝试恢复
  async attemptRecovery(errorInfo) {
    const strategies = this.recoveryStrategies.get(errorInfo.category) || [];
    const retryKey = `${errorInfo.category}_${errorInfo.context.episodeId || 'unknown'}`;
    const currentRetries = this.retryCount.get(retryKey) || 0;
    
    // 更新重试计数
    this.retryCount.set(retryKey, currentRetries + 1);
    
    for (const strategy of strategies) {
      try {
        if (this.options.logErrors) {
          console.log(`VideoErrorHandler: Attempting recovery with strategy: ${strategy.name}`);
        }
        
        // 等待延迟
        if (strategy.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, strategy.delay));
        }
        
        // 执行恢复策略
        const success = await this.executeRecoveryStrategy(strategy.name, errorInfo);
        
        if (success) {
          if (this.options.logErrors) {
            console.log(`VideoErrorHandler: Recovery successful with strategy: ${strategy.name}`);
          }
          
          // 重置重试计数
          this.retryCount.delete(retryKey);
          
          return { strategy: strategy.name, success: true };
        }
        
      } catch (recoveryError) {
        if (this.options.logErrors) {
          console.warn(`VideoErrorHandler: Recovery strategy ${strategy.name} failed:`, recoveryError);
        }
      }
    }
    
    return null;
  }
  
  // 执行恢复策略
  async executeRecoveryStrategy(strategyName, errorInfo) {
    const context = errorInfo.context;
    const playerSystem = context.playerSystem;
    
    if (!playerSystem) {
      console.warn('VideoErrorHandler: No player system in context');
      return false;
    }
    
    switch (strategyName) {
      case 'retry':
        return await this.retryCurrentVideo(playerSystem, context);
        
      case 'switch_source':
        return await this.switchToAlternativeSource(playerSystem, context);
        
      case 'reload_player':
        return await this.reloadPlayer(playerSystem, context);
        
      case 'fallback_iframe':
        return await this.fallbackToIframe(playerSystem, context);
        
      default:
        console.warn(`VideoErrorHandler: Unknown recovery strategy: ${strategyName}`);
        return false;
    }
  }
  
  // 重试当前视频
  async retryCurrentVideo(playerSystem, context) {
    try {
      if (playerSystem.currentEpisode) {
        playerSystem.loadVideo(playerSystem.currentEpisode, playerSystem.currentSource);
        return true;
      }
    } catch (error) {
      console.warn('VideoErrorHandler: Retry failed:', error);
    }
    return false;
  }
  
  // 切换到备用源
  async switchToAlternativeSource(playerSystem, context) {
    try {
      const currentEpisode = playerSystem.episodes.find(ep => ep.id === playerSystem.currentEpisode);
      if (!currentEpisode || !currentEpisode.alternatives || currentEpisode.alternatives.length === 0) {
        return false;
      }
      
      // 找到下一个可用的源
      const currentSourceIndex = currentEpisode.alternatives.findIndex(alt => alt.name === playerSystem.currentSource);
      const nextSourceIndex = (currentSourceIndex + 1) % (currentEpisode.alternatives.length + 1);
      
      let nextSource;
      if (nextSourceIndex === 0) {
        nextSource = 'primary';
      } else {
        nextSource = currentEpisode.alternatives[nextSourceIndex - 1].name;
      }
      
      if (nextSource !== playerSystem.currentSource) {
        playerSystem.switchSource(nextSource);
        return true;
      }
    } catch (error) {
      console.warn('VideoErrorHandler: Source switch failed:', error);
    }
    return false;
  }
  
  // 重新加载播放器
  async reloadPlayer(playerSystem, context) {
    try {
      const currentEpisode = playerSystem.currentEpisode;
      const currentSource = playerSystem.currentSource;
      const currentTime = playerSystem.getCurrentTime();
      
      // 销毁当前播放器
      if (playerSystem.artPlayer && playerSystem.artPlayer.destroy) {
        playerSystem.artPlayer.destroy();
      }
      
      // 重新初始化播放器
      playerSystem.initializePlayer();
      
      // 等待播放器初始化
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 恢复播放状态
      if (currentEpisode) {
        playerSystem.loadVideo(currentEpisode, currentSource);
        
        // 恢复播放位置
        if (currentTime > 0) {
          setTimeout(() => {
            playerSystem.seekTo(currentTime);
          }, 1500);
        }
      }
      
      return true;
    } catch (error) {
      console.warn('VideoErrorHandler: Player reload failed:', error);
    }
    return false;
  }
  
  // 回退到 iframe 模式
  async fallbackToIframe(playerSystem, context) {
    try {
      const currentEpisode = playerSystem.episodes.find(ep => ep.id === playerSystem.currentEpisode);
      if (!currentEpisode) return false;
      
      // 使用 iframe 播放器
      playerSystem.loadIframeVideo(`/player.html?url=${encodeURIComponent(currentEpisode.url)}`);
      
      return true;
    } catch (error) {
      console.warn('VideoErrorHandler: Iframe fallback failed:', error);
    }
    return false;
  }
  
  // 记录错误
  logError(errorInfo) {
    this.errorLog.push(errorInfo);
    
    // 限制日志大小
    if (this.errorLog.length > 100) {
      this.errorLog = this.errorLog.slice(-50);
    }
    
    if (this.options.logErrors) {
      console.error('VideoErrorHandler: Error logged:', errorInfo);
    }
  }
  
  // 显示用户友好的错误消息
  showUserError(errorInfo) {
    let userMessage = '视频播放出现问题';
    let suggestions = [];
    
    switch (errorInfo.category) {
      case 'network':
        userMessage = '网络连接出现问题';
        suggestions = [
          '检查网络连接',
          '尝试刷新页面',
          '稍后再试'
        ];
        break;
        
      case 'media':
        userMessage = '视频格式不支持或文件损坏';
        suggestions = [
          '尝试其他视频源',
          '检查浏览器是否支持该视频格式',
          '联系管理员'
        ];
        break;
        
      case 'source':
        userMessage = '视频源不可用';
        suggestions = [
          '尝试其他视频源',
          '稍后再试',
          '联系管理员'
        ];
        break;
        
      case 'player':
        userMessage = '播放器初始化失败';
        suggestions = [
          '刷新页面',
          '尝试其他浏览器',
          '检查浏览器是否支持现代功能'
        ];
        break;
    }
    
    this.displayErrorMessage(userMessage, suggestions, errorInfo);
  }
  
  // 显示错误消息界面
  displayErrorMessage(message, suggestions, errorInfo) {
    // 创建错误提示界面
    const errorOverlay = document.createElement('div');
    errorOverlay.className = 'video-error-overlay';
    errorOverlay.innerHTML = `
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <h3 class="error-title">${message}</h3>
        <div class="error-suggestions">
          <p>建议尝试：</p>
          <ul>
            ${suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
          </ul>
        </div>
        <div class="error-actions">
          <button class="retry-btn" onclick="location.reload()">刷新页面</button>
          <button class="details-btn" onclick="this.parentElement.parentElement.querySelector('.error-details').style.display='block'">查看详情</button>
        </div>
        <div class="error-details" style="display: none;">
          <h4>错误详情：</h4>
          <p><strong>类型：</strong> ${errorInfo.type}</p>
          <p><strong>消息：</strong> ${errorInfo.message}</p>
          <p><strong>时间：</strong> ${new Date(errorInfo.timestamp).toLocaleString()}</p>
          ${errorInfo.code ? `<p><strong>错误代码：</strong> ${errorInfo.code}</p>` : ''}
        </div>
      </div>
    `;
    
    // 添加到播放器容器
    const playerContainer = errorInfo.context.container || document.body;
    playerContainer.appendChild(errorOverlay);
    
    // 5分钟后自动移除
    setTimeout(() => {
      if (errorOverlay.parentNode) {
        errorOverlay.remove();
      }
    }, 300000);
  }
  
  // 获取错误统计
  getErrorStats() {
    const stats = {
      totalErrors: this.errorLog.length,
      errorsByCategory: {},
      errorsByType: {},
      recentErrors: this.errorLog.slice(-10),
      retryStats: Object.fromEntries(this.retryCount)
    };
    
    this.errorLog.forEach(error => {
      stats.errorsByCategory[error.category] = (stats.errorsByCategory[error.category] || 0) + 1;
      stats.errorsByType[error.type] = (stats.errorsByType[error.type] || 0) + 1;
    });
    
    return stats;
  }
  
  // 清理错误日志
  clearErrorLog() {
    this.errorLog = [];
    this.retryCount.clear();
  }
  
  // 添加自定义恢复策略
  addRecoveryStrategy(category, strategy) {
    if (!this.recoveryStrategies.has(category)) {
      this.recoveryStrategies.set(category, []);
    }
    this.recoveryStrategies.get(category).push(strategy);
  }
  
  // 移除恢复策略
  removeRecoveryStrategy(category, strategyName) {
    if (this.recoveryStrategies.has(category)) {
      const strategies = this.recoveryStrategies.get(category);
      const index = strategies.findIndex(s => s.name === strategyName);
      if (index > -1) {
        strategies.splice(index, 1);
      }
    }
  }
}

// 数据迁移工具类
class VideoDataMigrationTool {
  constructor(options = {}) {
    this.options = {
      batchSize: 10,
      validateAfterMigration: true,
      createBackup: true,
      logProgress: true,
      ...options
    };
    
    this.compatibilityHandler = new VideoCompatibilityHandler();
    this.migrationResults = [];
  }
  
  // 批量迁移页面内容中的视频数据
  async migratePageContent(contentSelector = '[data-video]') {
    const videoElements = document.querySelectorAll(contentSelector);
    const results = {
      total: videoElements.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      details: []
    };
    
    if (this.options.logProgress) {
      console.log(`VideoDataMigrationTool: Starting migration of ${videoElements.length} video elements`);
    }
    
    for (let i = 0; i < videoElements.length; i += this.options.batchSize) {
      const batch = Array.from(videoElements).slice(i, i + this.options.batchSize);
      const batchResults = await this.migrateBatch(batch);
      
      batchResults.forEach(result => {
        results.details.push(result);
        if (result.success) {
          results.successful++;
        } else if (result.skipped) {
          results.skipped++;
        } else {
          results.failed++;
        }
      });
      
      if (this.options.logProgress) {
        console.log(`VideoDataMigrationTool: Processed batch ${Math.floor(i / this.options.batchSize) + 1}`);
      }
      
      // 小延迟避免阻塞 UI
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    if (this.options.logProgress) {
      console.log('VideoDataMigrationTool: Migration completed', results);
    }
    
    return results;
  }
  
  // 迁移单个批次
  async migrateBatch(elements) {
    const promises = elements.map(element => this.migrateElement(element));
    return await Promise.all(promises);
  }
  
  // 迁移单个元素
  async migrateElement(element) {
    try {
      const videoDataAttr = element.getAttribute('data-video');
      if (!videoDataAttr) {
        return { element, success: false, skipped: true, reason: 'No video data found' };
      }
      
      let originalData;
      try {
        originalData = JSON.parse(videoDataAttr);
      } catch (parseError) {
        return { 
          element, 
          success: false, 
          skipped: false, 
          reason: 'Invalid JSON in data-video attribute',
          error: parseError.message 
        };
      }
      
      // 检查是否需要迁移
      if (!this.compatibilityHandler.needsMigration(originalData)) {
        return { element, success: true, skipped: true, reason: 'Already in new format' };
      }
      
      // 创建备份
      if (this.options.createBackup) {
        element.setAttribute('data-video-backup', videoDataAttr);
      }
      
      // 执行迁移
      const migratedData = this.compatibilityHandler.migrateToNewFormat(originalData);
      if (!migratedData) {
        return { 
          element, 
          success: false, 
          skipped: false, 
          reason: 'Migration failed - unable to convert data' 
        };
      }
      
      // 验证迁移结果
      if (this.options.validateAfterMigration) {
        const validation = this.compatibilityHandler.validateMigratedData(migratedData);
        if (!validation.valid) {
          return { 
            element, 
            success: false, 
            skipped: false, 
            reason: 'Migration validation failed',
            errors: validation.errors 
          };
        }
      }
      
      // 更新元素
      element.setAttribute('data-video', JSON.stringify(migratedData));
      element.setAttribute('data-migration-date', new Date().toISOString());
      
      return { 
        element, 
        success: true, 
        skipped: false, 
        originalFormat: this.compatibilityHandler.detectDataFormat(originalData),
        newFormat: this.compatibilityHandler.detectDataFormat(migratedData)
      };
      
    } catch (error) {
      return { 
        element, 
        success: false, 
        skipped: false, 
        reason: 'Unexpected error during migration',
        error: error.message 
      };
    }
  }
  
  // 回滚迁移
  rollbackMigration(contentSelector = '[data-video-backup]') {
    const elements = document.querySelectorAll(contentSelector);
    let rollbackCount = 0;
    
    elements.forEach(element => {
      const backupData = element.getAttribute('data-video-backup');
      if (backupData) {
        element.setAttribute('data-video', backupData);
        element.removeAttribute('data-video-backup');
        element.removeAttribute('data-migration-date');
        rollbackCount++;
      }
    });
    
    if (this.options.logProgress) {
      console.log(`VideoDataMigrationTool: Rolled back ${rollbackCount} elements`);
    }
    
    return rollbackCount;
  }
  
  // 清理备份数据
  cleanupBackups(contentSelector = '[data-video-backup]') {
    const elements = document.querySelectorAll(contentSelector);
    let cleanupCount = 0;
    
    elements.forEach(element => {
      element.removeAttribute('data-video-backup');
      cleanupCount++;
    });
    
    if (this.options.logProgress) {
      console.log(`VideoDataMigrationTool: Cleaned up ${cleanupCount} backup attributes`);
    }
    
    return cleanupCount;
  }
  
  // 验证迁移结果
  validateMigrationResults(contentSelector = '[data-video]') {
    const elements = document.querySelectorAll(contentSelector);
    const results = {
      total: elements.length,
      valid: 0,
      invalid: 0,
      details: []
    };
    
    elements.forEach(element => {
      try {
        const videoDataAttr = element.getAttribute('data-video');
        const videoData = JSON.parse(videoDataAttr);
        
        const validation = this.compatibilityHandler.validateMigratedData(videoData);
        
        if (validation.valid) {
          results.valid++;
        } else {
          results.invalid++;
          results.details.push({
            element,
            errors: validation.errors
          });
        }
      } catch (error) {
        results.invalid++;
        results.details.push({
          element,
          errors: ['Invalid JSON: ' + error.message]
        });
      }
    });
    
    return results;
  }
  
  // 生成迁移报告
  generateMigrationReport() {
    const stats = this.compatibilityHandler.getMigrationStats();
    
    return {
      timestamp: new Date().toISOString(),
      migrationStats: stats,
      toolOptions: this.options,
      recommendations: this.generateRecommendations(stats)
    };
  }
  
  // 生成建议
  generateRecommendations(stats) {
    const recommendations = [];
    
    if (stats.totalMigrations === 0) {
      recommendations.push('没有发现需要迁移的数据');
    } else {
      recommendations.push(`成功迁移了 ${stats.successfulMigrations} 个数据项`);
      
      if (stats.successfulMigrations < stats.totalMigrations) {
        recommendations.push('部分迁移失败，请检查错误日志');
      }
      
      if (stats.averageDataSizeChange > 0) {
        recommendations.push('迁移后数据大小有所增加，这是正常的（增加了更多元数据）');
      }
    }
    
    recommendations.push('建议在生产环境中使用前进行充分测试');
    recommendations.push('可以使用 rollbackMigration() 方法回滚更改');
    
    return recommendations;
  }
}

window.VideoPlayerSystem = VideoPlayerSystem;
window.EpisodeNavigation = EpisodeNavigation;
window.VideoSourceManager = VideoSourceManager;
window.PlaybackProgressManager = PlaybackProgressManager;
window.VideoData = VideoData;
window.VideoCompatibilityHandler = VideoCompatibilityHandler;
window.VideoDataMigrationTool = VideoDataMigrationTool;
window.VideoErrorHandler = VideoErrorHandler;
window.EpisodeLazyLoader = EpisodeLazyLoader;
window.VideoPreloader = VideoPreloader;
window.VideoCache = VideoCache;
window.NetworkMonitor = NetworkMonitor;

// 视频标签验证工具函数
window.VideoLabelValidator = {
  // 验证标签格式
  validate: function(label, type) {
    if (!label || typeof label !== 'string') {
      return {
        valid: false,
        error: '标签不能为空',
        defaultValue: type === 'movie' ? '电影' : '连续剧'
      };
    }
    
    label = label.trim();
    
    if (label.length === 0) {
      return {
        valid: false,
        error: '标签不能为空',
        defaultValue: type === 'movie' ? '电影' : '连续剧'
      };
    }
    
    if (label.length > 20) {
      return {
        valid: false,
        error: '标签长度不能超过20个字符',
        suggestion: label.substring(0, 20)
      };
    }
    
    const validPattern = /^[\u4e00-\u9fa5a-zA-Z0-9\s\-_.,!?()（）【】《》""''：:；;、。]+$/;
    if (!validPattern.test(label)) {
      return {
        valid: false,
        error: '标签包含无效字符，只允许中文、英文、数字和常用标点符号',
        defaultValue: type === 'movie' ? '电影' : '连续剧'
      };
    }
    
    return {
      valid: true,
      value: label
    };
  },
  
  // 格式化标签
  format: function(label, type) {
    const validation = this.validate(label, type);
    
    if (validation.valid) {
      return validation.value;
    } else if (validation.suggestion) {
      return validation.suggestion;
    } else {
      return validation.defaultValue;
    }
  },
  
  // 获取标签建议
  getSuggestions: function(type) {
    if (type === 'movie') {
      return ['电影', '正片', '影片', '完整版', '高清版', '导演剪辑版', '特别版'];
    } else if (type === 'series') {
      return ['连续剧', '电视剧', '第一季', '第二季', '完整版', '全集', '特别篇'];
    }
    return [];
  }
};