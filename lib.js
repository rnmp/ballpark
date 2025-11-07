window.$ = (q) => document.querySelector(q)
window.make = (element) => document.createElement(element)
window.sleep = (num) => new Promise(resolve => setTimeout(resolve, num))
