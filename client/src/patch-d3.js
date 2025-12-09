import * as d3Selection from 'd3-selection';
import * as d3Transition from 'd3-transition';
import * as d3Ease from 'd3-ease';
import * as d3Interpolate from 'd3-interpolate';

// Create a comprehensive D3 object
const d3 = Object.assign({}, d3Selection, d3Transition, d3Ease, d3Interpolate);

// Enhanced polyfill for D3 transitions
if (typeof d3.selection.prototype.interrupt !== 'function') {
  d3.selection.prototype.interrupt = function() {
    return this;
  };
}

if (typeof d3.selection.prototype.transition !== 'function') {
  d3.selection.prototype.transition = function(name) {
    // Use the real transition if available
    if (d3Transition.transition) {
      try {
        return d3Transition.transition.call(this, name);
      } catch (error) {
        console.warn('D3 transition error, using fallback:', error);
        return this;
      }
    }
    
    // Create a comprehensive mock transition object
    const mockTransition = Object.create(this);
    
    // Transition methods
    mockTransition.duration = function(duration) { 
      if (typeof duration === 'function') {
        duration.call(this);
      }
      return mockTransition; 
    };
    mockTransition.delay = function(delay) { 
      if (typeof delay === 'function') {
        delay.call(this);
      }
      return mockTransition; 
    };
    mockTransition.ease = function(ease) { return mockTransition; };
    mockTransition.on = function(type, listener) { return mockTransition; };
    mockTransition.tween = function(name, tween) { return mockTransition; };
    
    // Selection methods
    mockTransition.attr = function(name, value) { 
      if (typeof value === 'function') {
        value.call(this);
      }
      return mockTransition; 
    };
    mockTransition.attrTween = function(name, tween) { return mockTransition; };
    mockTransition.style = function(name, value) { 
      if (typeof value === 'function') {
        value.call(this);
      }
      return mockTransition; 
    };
    mockTransition.styleTween = function(name, tween) { return mockTransition; };
    mockTransition.text = function(value) { 
      if (typeof value === 'function') {
        value.call(this);
      }
      return mockTransition; 
    };
    mockTransition.textTween = function(tween) { return mockTransition; };
    mockTransition.remove = function() { return mockTransition; };
    mockTransition.select = function(selector) { return mockTransition; };
    mockTransition.selectAll = function(selector) { return mockTransition; };
    mockTransition.filter = function(selector) { return mockTransition; };
    mockTransition.merge = function(selection) { return mockTransition; };
    mockTransition.transition = function(name) { return mockTransition; };
    mockTransition.end = function() { return Promise.resolve(mockTransition); };
    
    // Additional methods that might be needed
    mockTransition.each = function(callback) { 
      if (typeof callback === 'function') {
        callback.call(this);
      }
      return mockTransition; 
    };
    mockTransition.call = function(callback) { 
      if (typeof callback === 'function') {
        callback.call(this);
      }
      return mockTransition; 
    };
    mockTransition.empty = function() { return false; };
    mockTransition.node = function() { return this.node(); };
    mockTransition.size = function() { return this.size(); };
    
    return mockTransition;
  };
}

// Patch the global d3 object
if (typeof window !== 'undefined') {
  window.d3 = d3;
  
  // Also patch any existing d3 objects
  if (window.d3 && window.d3.selection) {
    if (typeof window.d3.selection.prototype.interrupt !== 'function') {
      window.d3.selection.prototype.interrupt = d3.selection.prototype.interrupt;
    }
    if (typeof window.d3.selection.prototype.transition !== 'function') {
      window.d3.selection.prototype.transition = d3.selection.prototype.transition;
    }
  }
}

// Patch the global d3 object for Node.js environments
if (typeof global !== 'undefined') {
  global.d3 = d3;
}

// Patch for react-wordcloud compatibility
if (typeof window !== 'undefined') {
  // Ensure d3 is available globally for react-wordcloud
  window.d3 = window.d3 || d3;
  
  // Patch the selection prototype if it exists
  if (window.d3.selection && window.d3.selection.prototype) {
    const proto = window.d3.selection.prototype;
    if (typeof proto.transition !== 'function') {
      proto.transition = d3.selection.prototype.transition;
    }
    if (typeof proto.interrupt !== 'function') {
      proto.interrupt = d3.selection.prototype.interrupt;
    }
  }
}

export default d3;
