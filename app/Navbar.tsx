
export default function Navbar(){
    return (
        <div className="absolute top-0 right-0 p-4">
        <nav>
            <ul className="font-medium flex flex-col p-4 md:p-0 mt-4 border border-black rounded-lg bg-gray-50 md:flex-row md:space-x-8 rtl:space-x-reverse md:mt-0 md:border-0 md:bg-white dark:bg-black md:dark:bg-black">
                <li>
                <a href="#" className="block py-2 px-3 text-gray-900 rounded hover:bg-black md:hover:bg-transparent md:border-0 md:hover:text-blue-200 md:p-0 dark:text-white md:dark:hover:text-simliblue dark:hover:bg-gray-700 dark:hover:text-white md:dark:hover:bg-transparent">Billing</a>
                </li>
                <li>
                <a href="#" className="block py-2 px-3 text-gray-900 rounded hover:bg-black md:hover:bg-transparent md:border-0 md:hover:text-blue-200 md:p-0 dark:text-white md:dark:hover:text-simliblue dark:hover:bg-gray-700 dark:hover:text-white md:dark:hover:bg-transparent">Discord</a>
                </li>
                <li>
                <a href="#" className="block py-2 px-3 text-gray-900 rounded hover:bg-black md:hover:bg-transparent md:border-0 md:hover:text-[rgba(0, 0, 255)] md:p-0 dark:text-white md:dark:hover:text-simliblue dark:hover:bg-gray-700 dark:hover:text-white md:dark:hover:bg-transparent">Documentation</a>
                </li>
            </ul>
        </nav>
        </div>

    )
}
