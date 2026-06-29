import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
      <div className="relative">
        <h1 className="text-9xl font-extrabold tracking-widest text-gray-900 dark:text-white">404</h1>
        <div className="bg-orange-500 px-2 text-sm rounded rotate-12 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          Page Introuvable
        </div>
      </div>
      <div className="mt-5">
        <p className="text-lg font-medium text-gray-500 dark:text-gray-400">
          Désolé, nous n'avons pas pu trouver la page que vous cherchez.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-8 px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-md transition duration-200"
        >
          Retour au dashboard
        </button>
      </div>
    </div>
  );
}
