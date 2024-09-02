
export default function VideoBox(props: any) {
    return (
    
        <div className="flex justify-center items-center w-512 h-512">
        <video ref={props.video} id="simli_video" autoPlay playsInline className=""></video>
        <audio ref={props.audio} id="simli_audio" autoPlay ></audio>
        </div>

    );
}