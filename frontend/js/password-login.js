(function(){
 const tabs=[...document.querySelectorAll('[data-login-method]')];
 tabs.forEach(tab=>tab.addEventListener('click',()=>{const method=tab.dataset.loginMethod;tabs.forEach(t=>{const active=t===tab;t.classList.toggle('active',active);t.setAttribute('aria-selected',String(active));});document.querySelectorAll('[data-login-panel]').forEach(panel=>panel.hidden=panel.dataset.loginPanel!==method);}));
 const form=document.getElementById('phonePasswordForm'); if(!form)return;
 form.addEventListener('submit',async e=>{e.preventDefault();const msg=document.getElementById('phonePasswordMessage'),btn=form.querySelector('button[type="submit"]');btn.disabled=true;msg.textContent='Signing in…';
 try{const base=(window.VASTRA&&window.VASTRA.API_BASE)||localStorage.getItem('vastraApiBase')||'http://localhost:5000/api';const response=await fetch(base+'/auth/login-phone',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({phone:document.getElementById('phonePasswordNumber').value.trim(),password:document.getElementById('phonePassword').value})});const data=await response.json().catch(()=>({}));if(!response.ok||!data.success)throw new Error(data.message||'Unable to log in.');
 if(data.user&&data.user.role==='admin')throw new Error('Use Admin Login for administrator accounts.');
 if(window.VASTRA&&typeof window.VASTRA.setAuth==='function')window.VASTRA.setAuth(data);else{if(data.token)localStorage.setItem('vastraToken',data.token);if(data.user)localStorage.setItem('vastraUser',JSON.stringify(data.user));}
 if(window.VASTRA&&typeof window.VASTRA.migrateGuestCart==='function')await window.VASTRA.migrateGuestCart();msg.textContent='Login successful.';msg.className='form-message success';const next=sessionStorage.getItem('vastraReturnTo')||'profile.html';sessionStorage.removeItem('vastraReturnTo');location.href=next;
 }catch(err){msg.textContent=err.message;msg.className='form-message error';btn.disabled=false;}});
})();
