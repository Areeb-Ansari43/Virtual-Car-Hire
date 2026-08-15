(function(){
  // === Reveal on scroll ===
  const reveals = document.querySelectorAll('.reveal, .reveal-stagger');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    },{threshold:.12, rootMargin:'0px 0px -60px 0px'});
    reveals.forEach(el=>io.observe(el));
  } else reveals.forEach(el=>el.classList.add('in'));

  // === Animated count-up ===
  const counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window) {
    const cio = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{ if(e.isIntersecting){ animateCount(e.target); cio.unobserve(e.target); } });
    },{threshold:.4});
    counters.forEach(el=>cio.observe(el));
  } else counters.forEach(animateCount);
  function animateCount(el){
    const target = parseFloat(el.dataset.count), decimals = parseInt(el.dataset.decimals || '0', 10), dur = parseInt(el.dataset.duration || '1800', 10), start = performance.now();
    function tick(now){ const p=Math.min(1,(now-start)/dur), eased=1-Math.pow(1-p,3), val=target*eased; el.textContent=decimals?val.toFixed(decimals):Math.floor(val).toLocaleString(); if(p<1) requestAnimationFrame(tick); else el.textContent=decimals?target.toFixed(decimals):Math.floor(target).toLocaleString(); }
    requestAnimationFrame(tick);
  }

  // === Mobile menu ===
  const burger = document.querySelector('.burger'), navLinks = document.querySelector('.nav-links');
  if(burger && navLinks){ burger.addEventListener('click',()=>{ navLinks.classList.toggle('open'); if(navLinks.classList.contains('open')) Object.assign(navLinks.style,{display:'flex',flexDirection:'column',position:'absolute',top:'72px',right:'20px',background:'#0f0f12',padding:'14px',border:'1px solid #22222a',borderRadius:'14px',gap:'4px',zIndex:'200'}); else navLinks.style.cssText=''; }); }

  // === Fleet filter (only on fleet page) ===
  const filterBtns = document.querySelectorAll('.car-filters [data-filter]');
  if(filterBtns.length){ filterBtns.forEach(btn=>btn.addEventListener('click',()=>{ const f=btn.dataset.filter; filterBtns.forEach(b=>b.classList.remove('active')); btn.classList.add('active'); document.querySelectorAll('.car').forEach(car=>{ car.style.display=(f==='all'||car.dataset.brand===f)?'':'none'; }); })); }

  // === WhatsApp enquiry ===
  const enquiryForm = document.getElementById('whatsappEnquiryForm');
  if(enquiryForm){
    const success = document.getElementById('whatsappSuccess'), send = document.getElementById('sendWhatsapp'), edit = document.getElementById('editEnquiry'), submit = enquiryForm.querySelector('button[type="submit"]');
    enquiryForm.addEventListener('submit',(event)=>{
      event.preventDefault();
      if(!enquiryForm.checkValidity()){ enquiryForm.reportValidity(); return; }
      const data = new FormData(enquiryForm), first = String(data.get('firstName')).trim(), last = String(data.get('lastName')).trim(), car = String(data.get('car')).trim();
      const message = `Hi Virtual Car Hire, my name is ${first} ${last}. I’m interested in renting the ${car}. Please could you share availability and the next steps?`;
      send.href = `https://wa.me/447508496940?text=${encodeURIComponent(message)}`;
      submit.classList.add('is-loading'); submit.disabled = true; submit.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Preparing your message…';
      window.setTimeout(()=>{ enquiryForm.classList.add('is-complete'); success.classList.add('show'); submit.classList.remove('is-loading'); submit.disabled=false; }, 720);
    });
    if(edit) edit.addEventListener('click',()=>{ enquiryForm.classList.remove('is-complete'); success.classList.remove('show'); submit.innerHTML='<i class="fab fa-whatsapp"></i> Prepare WhatsApp message'; });
  }
})();
