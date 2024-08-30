
export default function VideoBox(props: any) {
    return (
        <div className="relative w-full aspect-video rounded-full">
        <video ref={props.video} id="simli_video" autoPlay playsInline className="w-full h-full rounded-full"></video>
        <audio ref={props.audio} id="simli_audio" autoPlay ></audio>
        </div>
    );
}