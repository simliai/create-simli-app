
export default function VideoBox(props: any) {
    return (
        <div className="aspect-video flex items-center h-400 w-400 clientWidth-512 justify-center">
            <video ref={props.video} id="simli_video" autoPlay playsInline className="items-center justify-center"></video>
            <audio ref={props.audio} id="simli_audio" autoPlay ></audio>
        </div>
    );
}