import { chromium } from 'playwright';

(async () => {
  console.log("Iniciando automatización de Playwright para la consola de Firebase...");
  
  // Lanzamos el navegador visible para que el usuario pueda pasar el login de Google
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("👉 Por favor, inicia sesión con tu cuenta de Google si se te solicita.");
  await page.goto('https://console.firebase.google.com/project/eugeniofuenzalidaps/storage');

  try {
    // Esperamos pacientemente hasta que el botón de "Get Started" o "Empezar" aparezca
    // (Esto significa que el usuario pasó el login con éxito y cargó el proyecto)
    console.log("Esperando a que estés logueado y cargue la página de Storage...");
    
    // Selectores para botones de iniciar (soportan inglés y español)
    const getStartedBtn = page.locator('button:has-text("Get started"), button:has-text("Comenzar")').first();
    await getStartedBtn.waitFor({ state: 'visible', timeout: 0 }); // Espera infinita para dar tiempo al login
    
    console.log("¡Botón detectado! Tomando el control para habilitar Storage...");
    await getStartedBtn.click();

    // Siguiente paso del modal (Modo Producción o Prueba)
    const nextBtn = page.locator('button:has-text("Next"), button:has-text("Siguiente")').first();
    await nextBtn.waitFor({ state: 'visible' });
    await nextBtn.click();

    // Confirmar ubicación del servidor
    const doneBtn = page.locator('button:has-text("Done"), button:has-text("Listo")').first();
    await doneBtn.waitFor({ state: 'visible' });
    await doneBtn.click();

    console.log("⏳ Creando el bucket de Storage (esto puede tardar unos segundos)...");
    
    // Esperamos a que el proceso termine (el botón Done desaparece o aparece la vista de archivos)
    await page.waitForURL('**/storage/browser**', { timeout: 60000 });
    console.log("✅ ¡Firebase Storage ha sido inicializado exitosamente!");

  } catch (e) {
    console.error("Hubo un error en la automatización o cerraste la ventana: ", e);
  } finally {
    console.log("Cerrando navegador automatizado...");
    await browser.close();
    console.log("Ya puedes volver a mi chat. Desplegaré las reglas de seguridad ahora.");
  }
})();
