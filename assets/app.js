/* Shared JS — count up + reveal on scroll + mobile menu */
(function(){
  // === Reveal on scroll ===
  const reveals = document.querySelectorAll('.reveal, .reveal-stagger');
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  },{threshold:.12, rootMargin:'0px 0px -60px 0px'});
  reveals.forEach(el=>io.observe(el));

  // === Animated count-up ===
  const counters = document.querySelectorAll('[data-count]');
  const cio = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        animateCount(e.target);
        cio.unobserve(e.target);
      }
    });
  },{threshold:.4});
  counters.forEach(el=>cio.observe(el));

  function animateCount(el){
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const dur = parseInt(el.dataset.duration || '1800', 10);
    const start = performance.now();
    function tick(now){
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      const val = target * eased;
      el.textContent = decimals ? val.toFixed(decimals) : Math.floor(val).toLocaleString();
      if(p < 1) requestAnimationFrame(tick);
      else el.textContent = decimals ? target.toFixed(decimals) : Math.floor(target).toLocaleString();
    }
    requestAnimationFrame(tick);
  }

  // === Mobile menu ===
  const burger = document.querySelector('.burger');
  const navLinks = document.querySelector('.nav-links');
  if(burger && navLinks){
    burger.addEventListener('click', ()=>{
      navLinks.classList.toggle('open');
      if(navLinks.classList.contains('open')){
        Object.assign(navLinks.style,{
          display:'flex',flexDirection:'column',position:'absolute',
          top:'72px',right:'20px',background:'#0f0f12',padding:'14px',
          border:'1px solid #22222a',borderRadius:'14px',gap:'4px',zIndex:'200'
        });
      } else {
        navLinks.style.cssText = '';
      }
    });
  }

  // === Fleet filter (only on fleet page) ===
  const filterBtns = document.querySelectorAll('.car-filters [data-filter]');
  if(filterBtns.length){
    filterBtns.forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const f = btn.dataset.filter;
        filterBtns.forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.car').forEach(car=>{
          if(f === 'all' || car.dataset.brand === f){
            car.style.display = '';
          } else {
            car.style.display = 'none';
          }
        });
      });
    });
  }
})();
