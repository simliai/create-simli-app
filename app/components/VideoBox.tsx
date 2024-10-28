
export default function VideoBox(props: any) {
    return (
        <div className="aspect-video flex items-center h-[350px] w-[350px] justify-center bg-simligray">
            <video ref={props.video} autoPlay playsInline></video>
            <audio ref={props.audio} autoPlay ></audio>
        </div>
    );
}