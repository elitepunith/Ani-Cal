const wallpaperImage = document.getElementById('wallpaper');

const clockElement = document.getElementById('clock'); 


function changeWallpaper() {

    const uniqueTime = new Date().getTime();

    wallpaperImage.src = `https://picsum.photos/1920/1080?random=${uniqueTime}`;


}


setInterval(changeWallpaper, 5000);


function updateClock() {

    const now = new Date();
    
    let hours = now.getHours();

    let minutes = now.getMinutes();

    let ampm = hours >= 12 ? 'PM' : 'AM';
    
    
    hours = hours % 12;

    hours = hours ? hours : 12; 
    
   
    minutes = minutes < 10 ? '0' + minutes : minutes;
    
   
    clockElement.textContent = `${hours}:${minutes} ${ampm}`;

}


updateClock();

setInterval(updateClock, 1000);