
export default function VideoBox(props: any) {
    return (
        <div className="aspect-video flex items-center h-350 w-350 justify-center">
            <video ref={props.video} autoPlay playsInline></video>
            <audio ref={props.audio} autoPlay ></audio>
        </div>
    );
}