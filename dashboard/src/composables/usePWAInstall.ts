import { ref, onMounted, onUnmounted } from 'vue';

export function usePWAInstall() {
  const deferredPrompt = ref<Event | null>(null);
  const isInstallable = ref(false);
  const isInstalled = ref(false);

  const handleBeforeInstallPrompt = (e: Event) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt.value = e;
    isInstallable.value = true;
  };

  const installPWA = async () => {
    if (!deferredPrompt.value) {
      return false;
    }

    // Show the install prompt
    (deferredPrompt.value as any).prompt();
    
    // Wait for the user to respond to the prompt
    const choiceResult = await (deferredPrompt.value as any).userChoice;
    
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted the install prompt');
      isInstalled.value = true;
      isInstallable.value = false;
      return true;
    } else {
      console.log('User dismissed the install prompt');
      return false;
    }
  };

  const checkIfInstalled = () => {
    // Check if the app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      isInstalled.value = true;
      isInstallable.value = false;
    }
  };

  onMounted(() => {
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      isInstalled.value = true;
      isInstallable.value = false;
    });
    
    // Check if already installed
    checkIfInstalled();
  });

  onUnmounted(() => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  });

  return {
    isInstallable,
    isInstalled,
    installPWA,
  };
}