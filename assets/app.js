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
  if(filterBtns.length){
    const fleetSections = document.querySelectorAll('.fleet-group[data-brand]');
    filterBtns.forEach(btn=>btn.addEventListener('click',()=>{
      const f=btn.dataset.filter;
      filterBtns.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      if(fleetSections.length){
        fleetSections.forEach(section=>{
          const visible=f==='all'||section.dataset.brand===f;
          section.hidden=!visible;
          section.classList.toggle('hide-group',!visible);
        });
      }
    }));
  }

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

  // === Emergency AI enquiry ===
  const emergencyForm = document.getElementById('emergencyEnquiryForm');
  if(emergencyForm){
    const success = document.getElementById('emergencySuccess'), aiReply = document.getElementById('emergencyAiReply'), send = document.getElementById('sendEmergencyWhatsapp'), edit = document.getElementById('editEmergency'), submit = emergencyForm.querySelector('button[type="submit"]');
    emergencyForm.addEventListener('submit',async(event)=>{
      event.preventDefault();
      if(!emergencyForm.checkValidity()){ emergencyForm.reportValidity(); return; }
      const data = new FormData(emergencyForm), first = String(data.get('firstName')).trim(), last = String(data.get('lastName')).trim(), issue = String(data.get('issue')).trim(), vehicle = String(data.get('vehicle')).trim(), details = String(data.get('details')).trim();
      const message = `URGENT Virtual Car Hire enquiry. My name is ${first} ${last}. I need help with: ${issue}. Vehicle: ${vehicle}. Details: ${details}`;
      send.href = `https://wa.me/442072946756?text=${encodeURIComponent(message)}`;
      submit.classList.add('is-loading'); submit.disabled = true; submit.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Reading your message…';
      if(aiReply) aiReply.textContent = 'Reading your message and preparing immediate guidance…';
      try {
        const response = await fetch('https://servicevch.pages.dev/api/public/ai-intake', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ kind: issue.toLowerCase().includes('breakdown') ? 'emergency' : issue.toLowerCase().includes('crash') ? 'accident' : 'whatsapp', name:`${first} ${last}`, issue, vehicle, text:details }) });
        const result = await response.json();
        if(aiReply) aiReply.textContent = result.reply || 'Your message has been received. Please continue in WhatsApp for live updates and media sharing.';
      } catch(error) {
        console.error('Emergency AI intake failed', error);
        if(aiReply) aiReply.textContent = 'Your message is ready. Please continue in WhatsApp so the support assistant can help you immediately.';
      }
      emergencyForm.classList.add('is-complete'); success.classList.add('show'); submit.classList.remove('is-loading'); submit.disabled=false; submit.innerHTML='<i class="fab fa-whatsapp"></i> Prepare emergency WhatsApp';
    });
    if(edit) edit.addEventListener('click',()=>{ emergencyForm.classList.remove('is-complete'); success.classList.remove('show'); submit.innerHTML='<i class="fab fa-whatsapp"></i> Prepare emergency WhatsApp'; });
  }
})();
